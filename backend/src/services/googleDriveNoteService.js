import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { env } from '../config/env.js';
import Note from '../models/Note.js';

const DRIVE_SCOPE = ['https://www.googleapis.com/auth/drive.readonly'];
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const GOOGLE_DOC_MIME_TYPES = new Set([
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.drawing'
]);

let syncInFlight;

const getCredentials = () => {
  if (env.googleServiceAccountJson) {
    try {
      return JSON.parse(env.googleServiceAccountJson);
    } catch {
      throw new Error('Google Drive service-account JSON is not valid JSON.');
    }
  }

  if (env.googleServiceAccountFile) {
    try {
      const resolvedPath = path.resolve(env.googleServiceAccountFile);
      return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
    } catch {
      throw new Error('Unable to read or parse the Google Drive service-account file.');
    }
  }

  throw new Error('Google Drive is not configured. Set the service-account credentials.');
};

export const getDriveClient = () => {
  if (!env.googleDriveFolderId) {
    throw new Error('Google Drive is not configured. Set GOOGLE_DRIVE_FOLDER_ID.');
  }

  const serviceAccount = getCredentials();
  if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
    throw new Error('Google Drive service-account credentials are missing required fields.');
  }

  const auth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key.replace(/\\n/g, '\n'),
    scopes: DRIVE_SCOPE
  });

  return google.drive({ version: 'v3', auth });
};

const toDisplayType = (mimeType = '') => {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('sheet')) return 'spreadsheet';
  if (mimeType.includes('presentation')) return 'presentation';
  if (mimeType.includes('document')) return 'document';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('csv')) return 'text';
  return 'other';
};

const toSafeExtension = (fileName = '') => {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1 || lastDot === fileName.length - 1) return '';
  return fileName.slice(lastDot + 1).toLowerCase();
};

const getExportMimeType = (mimeType = '') => {
  if (mimeType === 'application/vnd.google-apps.drawing') return 'image/png';
  if (GOOGLE_DOC_MIME_TYPES.has(mimeType)) return 'application/pdf';
  return mimeType || 'application/octet-stream';
};

const sanitizeDriveFile = (file, folderPath, rootName, folderPathSegments) => {
  const mimeType = file.mimeType || 'application/octet-stream';
  const title = String(file.name || 'Untitled note').trim() || 'Untitled note';

  return {
    driveFileId: file.id,
    title,
    description: file.description || '',
    category: folderPathSegments[1] || rootName,
    fileType: toDisplayType(mimeType),
    mimeType,
    extension: toSafeExtension(title),
    size: Number(file.size || 0),
    folderPath,
    folderPathSegments,
    driveCreatedAt: file.createdTime ? new Date(file.createdTime) : null,
    driveUpdatedAt: file.modifiedTime ? new Date(file.modifiedTime) : null,
    viewMimeType: getExportMimeType(mimeType),
    isActive: true,
    lastSyncedAt: new Date()
  };
};

const listFilesInFolder = async (drive, folderId, folderPath, folderPathSegments, rootName, seenFolders, discoveredFiles, stats) => {
  if (seenFolders.has(folderId)) return;
  seenFolders.add(folderId);

  let pageToken;
  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, description, parents)',
      pageSize: 1000,
      pageToken,
      orderBy: 'folder, name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    for (const file of response.data.files || []) {
      if (!file.id) throw new Error('Google Drive returned a file without an ID.');
      if (file.mimeType === FOLDER_MIME_TYPE) {
        stats.foldersFound += 1;
        const childName = file.name || 'Untitled folder';
        const childPath = `${folderPath}/${childName}`;
        await listFilesInFolder(drive, file.id, childPath, [...folderPathSegments, childName], rootName, seenFolders, discoveredFiles, stats);
        continue;
      }

      if (discoveredFiles.has(file.id)) {
        stats.duplicatesSkipped += 1;
        continue;
      }

      discoveredFiles.set(file.id, sanitizeDriveFile(file, folderPath, rootName, folderPathSegments));
    }

    pageToken = response.data.nextPageToken;
  } while (pageToken);
};

const performGoogleDriveNoteSync = async () => {
  const drive = getDriveClient();
  const rootResponse = await drive.files.get({
    fileId: env.googleDriveFolderId,
    fields: 'id, name, mimeType',
    supportsAllDrives: true
  });
  const rootFolder = rootResponse.data;

  if (rootFolder.mimeType !== FOLDER_MIME_TYPE) {
    throw new Error('The configured Google Drive root ID is not a folder.');
  }

  const stats = { foldersFound: 0, duplicatesSkipped: 0 };
  const discoveredFiles = new Map();
  await listFilesInFolder(
    drive,
    rootFolder.id,
    rootFolder.name || 'Shared notes',
    [rootFolder.name || 'Shared notes'],
    rootFolder.name || 'Shared notes',
    new Set(),
    discoveredFiles,
    stats
  );

  const notes = [...discoveredFiles.values()];
  let filesAdded = 0;
  let filesUpdated = 0;

  for (let offset = 0; offset < notes.length; offset += 500) {
    const batch = notes.slice(offset, offset + 500);
    const result = await Note.bulkWrite(
      batch.map((note) => ({
        updateOne: {
          filter: { driveFileId: note.driveFileId },
          update: {
            $set: note,
            $setOnInsert: { customTitle: '', isPublic: false, isDeleted: false }
          },
          upsert: true
        }
      })),
      { ordered: true }
    );

    filesAdded += result.upsertedCount || 0;
    filesUpdated += batch.length - (result.upsertedCount || 0);
  }

  const result = await Note.updateMany(
    { isActive: true, isDeleted: { $ne: true }, driveFileId: { $nin: notes.map((note) => note.driveFileId) } },
    { $set: { isActive: false, lastSyncedAt: new Date() } }
  );

  const summary = {
    rootFolder: { id: rootFolder.id, name: rootFolder.name || 'Shared notes' },
    foldersFound: stats.foldersFound,
    filesFound: notes.length + stats.duplicatesSkipped,
    filesAdded,
    filesUpdated,
    duplicatesSkipped: stats.duplicatesSkipped,
    errors: 0,
    deactivatedCount: result.modifiedCount || 0,
    lastSyncedAt: new Date().toISOString()
  };

  console.info([
    'Google Drive Sync Completed',
    `Root Folder: ${summary.rootFolder.name}`,
    `Folders Found: ${summary.foldersFound}`,
    `Files Found: ${summary.filesFound}`,
    `Files Added: ${summary.filesAdded}`,
    `Files Updated: ${summary.filesUpdated}`,
    `Duplicates Skipped: ${summary.duplicatesSkipped}`,
    `Errors: ${summary.errors}`
  ].join('\n'));

  return summary;
};

export const syncGoogleDriveNotes = () => {
  if (!syncInFlight) {
    syncInFlight = performGoogleDriveNoteSync().finally(() => {
      syncInFlight = undefined;
    });
  }
  return syncInFlight;
};

export const streamDriveFileContent = async (note) => {
  const drive = getDriveClient();
  const mimeType = note.mimeType || 'application/octet-stream';
  const targetMimeType = note.viewMimeType || getExportMimeType(mimeType);

  let response;
  if (GOOGLE_DOC_MIME_TYPES.has(mimeType)) {
    response = await drive.files.export({
      fileId: note.driveFileId,
      mimeType: targetMimeType
    }, { responseType: 'arraybuffer' });
  } else if (mimeType === 'application/vnd.google-apps.form') {
    throw Object.assign(new Error('Google Forms cannot be previewed by the Drive API.'), { statusCode: 415 });
  } else {
    response = await drive.files.get({
      fileId: note.driveFileId,
      alt: 'media',
      supportsAllDrives: true
    }, { responseType: 'arraybuffer' });
  }

  const bytes = response.data;
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const finalMimeType = response.headers?.['content-type'] || targetMimeType || mimeType;
  return { buffer, mimeType: finalMimeType };
};
