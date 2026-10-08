import mongoose from 'mongoose';
import path from 'path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import Note from '../models/Note.js';
import NoteFolder from '../models/NoteFolder.js';
import NotePayment from '../models/NotePayment.js';
import { getAcademicNoteBucket } from '../config/storage.js';
import { streamDriveFileContent, syncGoogleDriveNotes } from '../services/googleDriveNoteService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const sanitizeNote = (note) => {
  const dto = note.toObject ? note.toObject() : { ...note };
  const id = String(dto._id);
  delete dto.content;
  return {
    ...dto,
    title: dto.customTitle || dto.title,
    id,
    _id: id,
    driveFileId: dto.storageType === 'googleDrive' ? dto.driveFileId : undefined,
    viewerUrl: `/api/student/notes/${id}/view`,
    downloadUrl: `/api/admin/notes/${id}/download`
  };
};

const sanitizeFolder = (folder, fileCount = 0) => ({
  id: String(folder._id),
  _id: String(folder._id),
  name: folder.name,
  path: folder.path,
  parentId: folder.parentId ? String(folder.parentId) : null,
  source: folder.source,
  fileCount,
  createdAt: folder.createdAt,
  updatedAt: folder.updatedAt
});

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const safeFileName = (value) => String(value || 'note').replace(/[\\/:*?"<>|\r\n]/g, '_');
const getNoteFolderRoot = (note) => note.folderPathSegments?.[0] || 'Notes';
const noteIsPaid = (note) => note.accessType === 'paid';

async function getPurchasedNoteIds(studentId, notes) {
  const noteIds = notes.filter(noteIsPaid).map((note) => note._id);
  if (!noteIds.length) return new Set();
  const purchases = await NotePayment.find({ studentId, noteId: { $in: noteIds }, status: 'captured' }).select('noteId').lean();
  return new Set(purchases.map((purchase) => String(purchase.noteId)));
}

async function studentHasNoteAccess(studentId, note) {
  if (!noteIsPaid(note)) return true;
  return Boolean(await NotePayment.exists({ studentId, noteId: note._id, status: 'captured' }));
}

function noteDtoWithAccess(note, purchasedIds) {
  const dto = sanitizeNote(note);
  if (dto.accessType !== 'paid') return { ...dto, hasAccess: true };
  return { ...dto, hasAccess: purchasedIds?.has(String(dto._id)) || false };
}
const parseVisibility = (value) => {
  if (value === undefined) return false;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw Object.assign(new Error('Student visibility must be true or false.'), { statusCode: 400, name: 'InvalidVisibility' });
};
const driveLinkIsAllowed = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      ['drive.google.com', 'docs.google.com'].includes(url.hostname.toLowerCase()) &&
      !url.username && !url.password;
  } catch {
    return false;
  }
};

async function resolveFolder(folderId) {
  if (!folderId) return null;
  if (!isValidObjectId(folderId)) {
    throw Object.assign(new Error('Invalid folder id.'), { statusCode: 400, name: 'InvalidFolderId' });
  }
  const folder = await NoteFolder.findOne({ _id: folderId, isDeleted: { $ne: true } });
  if (!folder) throw Object.assign(new Error('Folder not found.'), { statusCode: 404, name: 'FolderNotFound' });
  return folder;
}

function folderFields(folder) {
  return {
    folderId: folder?._id || null,
    folderPath: folder ? `Notes/${folder.path}` : 'Notes',
    folderPathSegments: folder ? ['Notes', ...folder.path.split('/')] : ['Notes'],
    category: folder?.name || 'General'
  };
}

function countFolderFiles(folder, allFolders, notes) {
  const descendantIds = new Set(allFolders
    .filter((item) => item.path === folder.path || item.path.startsWith(`${folder.path}/`))
    .map((item) => String(item._id)));
  const legacyPath = folder.sourcePath || folder.path;
  return notes.filter((note) => note.folderId
    ? descendantIds.has(String(note.folderId))
    : note.folderPath === folder.path || String(note.folderPath || '').startsWith(`${legacyPath}/`)
  ).length;
}

function setFileResponseHeaders(res, note, disposition) {
  const filename = safeFileName(note.customTitle || note.title);
  res.setHeader('Content-Type', note.viewMimeType || note.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
}

async function streamNoteFile(note, res, next, disposition) {
  if (note.storageType === 'driveLink') {
    return res.redirect(302, note.driveUrl);
  }
  if (note.storageType === 'mongodb') {
    setFileResponseHeaders(res, note, disposition);
    return res.status(200).send(note.content || '');
  }
  if (note.storageType === 'gridfs') {
    setFileResponseHeaders(res, note, disposition);
    const stream = getAcademicNoteBucket().openDownloadStream(note.gridFsFileId);
    stream.once('error', (error) => {
      if (!res.headersSent) next(error);
      else res.destroy(error);
    });
    return stream.pipe(res);
  }
  const { buffer, mimeType } = await streamDriveFileContent(note);
  setFileResponseHeaders(res, { ...note.toObject(), mimeType, viewMimeType: mimeType }, disposition);
  return res.status(200).send(buffer);
}

export const syncNotesFromDrive = async (_req, res, next) => {
  try {
    const result = await syncGoogleDriveNotes();
    return res.status(200).json(successResponse('Notes synced from Google Drive.', result));
  } catch (error) {
    next(error);
  }
};

export const listStudentNotes = async (req, res, next) => {
  try {
    const notes = await Note.find({
      isActive: true,
      isDeleted: { $ne: true },
      fileType: { $ne: 'folder' },
      $or: [{ isPublic: true }, { isPublic: { $exists: false } }]
    }).sort({ updatedAt: -1 });
    const purchasedIds = await getPurchasedNoteIds(req.user.id, notes);

    const categoryCounts = notes.reduce((counts, note) => {
      const category = note.category || 'General';
      counts[category] = (counts[category] || 0) + 1;
      return counts;
    }, {});
    const driveRootName = notes.find((note) => note.storageType === 'googleDrive' || !note.storageType)
      ? getNoteFolderRoot(notes.find((note) => note.storageType === 'googleDrive' || !note.storageType))
      : 'Notes';
    return res.status(200).json(successResponse('Student notes retrieved.', {
      notes: notes.map((note) => {
        const dto = sanitizeNote(note);
        const segments = [...(dto.folderPathSegments || [])];
        if (segments[0] === 'Notes') segments[0] = driveRootName;
        return {
          ...noteDtoWithAccess(dto, purchasedIds),
          folderPathSegments: segments,
          folderPath: segments.join('/') || driveRootName
        };
      }),
      totalNotes: notes.length,
      categoryCounts
    }));
  } catch (error) {
    next(error);
  }
};

export const listDashboardNotes = async (req, res, next) => {
  try {
    const filter = {
      isActive: true,
      isDeleted: { $ne: true },
      fileType: { $ne: 'folder' },
      $or: [{ isPublic: true }, { isPublic: { $exists: false } }]
    };
    let purchasedIds = new Set();
    if (req.user.role === 'student') {
      const purchases = await NotePayment.find({ studentId: req.user.id, status: 'captured' }).select('noteId').lean();
      purchasedIds = new Set(purchases.map((purchase) => String(purchase.noteId)));
      filter.$and = [{
        $or: [
          { accessType: { $ne: 'paid' } },
          { _id: { $in: [...purchasedIds] } }
        ]
      }];
    }
    const visibleNotes = await Note.find(filter).sort({ updatedAt: -1 }).limit(6).lean();
    return res.status(200).json(successResponse('Shared dashboard notes retrieved.', {
      notes: visibleNotes.map((note) => ({
        ...sanitizeNote(note),
        hasAccess: req.user.role !== 'student' || !noteIsPaid(note) || purchasedIds.has(String(note._id))
      }))
    }));
  } catch (error) {
    next(error);
  }
};

export const listAdminNotes = async (_req, res, next) => {
  try {
    const { search = '', type = '', folderId = '', sort = 'newest' } = _req.query;
    const filter = { fileType: { $ne: 'folder' } };
    const searchText = String(search).trim();
    if (searchText) {
      const expression = new RegExp(escapeRegex(searchText), 'i');
      const matchingFolders = await NoteFolder.find({ $or: [{ name: expression }, { path: expression }] }).select('_id').lean();
      filter.$or = [
        { title: expression },
        { customTitle: expression },
        { originalName: expression },
        { category: expression },
        { folderPath: expression },
        { fileType: expression },
        { storageType: expression },
        { extension: expression },
        { mimeType: expression },
        { folderId: { $in: matchingFolders.map((folder) => folder._id) } }
      ];
    }
    if (!['', 'all', 'pdf', 'created', 'driveLink', 'folder'].includes(type)) {
      return res.status(400).json(errorResponse('Invalid note type filter.', 'Bad Request', 400));
    }
    if (type === 'pdf') filter.fileType = 'pdf';
    if (type === 'created') filter.storageType = 'mongodb';
    if (type === 'driveLink') filter.storageType = 'driveLink';
    if (folderId === 'root') filter.folderId = null;
    else if (folderId && isValidObjectId(folderId)) filter.folderId = folderId;
    else if (folderId && folderId !== 'all') return res.status(400).json(errorResponse('Invalid folder id.', 'Bad Request', 400));

    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      name: { title: 1, customTitle: 1 },
      size: { size: -1 }
    };
    if (!Object.hasOwn(sortOptions, sort)) return res.status(400).json(errorResponse('Invalid note sort option.', 'Bad Request', 400));

    const folderFilter = folderId === 'all' ? {} : folderId && folderId !== 'root' ? { parentId: folderId } : { parentId: null };
    if (searchText) {
      const folderSearchExpression = new RegExp(escapeRegex(searchText), 'i');
      folderFilter.$or = [{ name: folderSearchExpression }, { path: folderSearchExpression }];
    }
    const [notes, folders, allFolders] = await Promise.all([
      type === 'folder' ? [] : Note.find(filter).sort(sortOptions[sort]).lean(),
      type && type !== 'all' && type !== 'folder' ? [] : NoteFolder.find({ ...folderFilter, isDeleted: { $ne: true } }).sort({ name: 1 }).lean(),
      NoteFolder.find({ isDeleted: { $ne: true } }).select('_id path sourcePath').lean()
    ]);
    const noteFolderCounts = await Note.find({ isDeleted: { $ne: true }, fileType: { $ne: 'folder' } }).select('folderId folderPath').lean();
    const folderPaths = new Map(allFolders.map((folder) => [String(folder._id), folder.path]));
    const folderItems = folders.map((folder) => sanitizeFolder(folder, countFolderFiles(folder, allFolders, noteFolderCounts)));
    const activeNotes = notes.filter((note) => note.isActive && !note.isDeleted);
    const publicNotes = activeNotes.filter((note) => note.isPublic === true || note.isPublic === undefined);

    return res.status(200).json(successResponse('Notes administration data retrieved.', {
      notes: notes.map((note) => {
        const dto = sanitizeNote(note);
        const managedPath = note.folderId ? folderPaths.get(String(note.folderId)) : '';
        return managedPath ? { ...dto, folderPath: managedPath, category: managedPath.split('/').at(-1) } : dto;
      }),
      folders: folderItems,
      stats: {
        totalNotes: await Note.countDocuments({ fileType: { $ne: 'folder' } }),
        activeNotes: activeNotes.length,
        publicNotes: publicNotes.length,
        privateNotes: activeNotes.length - publicNotes.length,
        deletedNotes: notes.filter((note) => note.isDeleted).length,
        googleDriveBytes: activeNotes.filter((note) => note.storageType === 'googleDrive').reduce((total, note) => total + Number(note.size || 0), 0),
        totalFiles: notes.length
      }
    }));
  } catch (error) {
    next(error);
  }
};

export const listAdminNoteFolders = async (_req, res, next) => {
  try {
    const [folders, files] = await Promise.all([
      NoteFolder.find({ isDeleted: { $ne: true } }).sort({ path: 1 }).lean(),
      Note.find({ isDeleted: { $ne: true }, fileType: { $ne: 'folder' } }).select('folderId folderPath').lean()
    ]);
    const result = folders.map((folder) => sanitizeFolder(folder, countFolderFiles(folder, folders, files)));
    return res.status(200).json(successResponse('Note folders retrieved.', { folders: result }));
  } catch (error) {
    next(error);
  }
};

export const updateAdminNote = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(noteId)) {
      return res.status(400).json(errorResponse('Invalid note id.', 'Bad Request', 400));
    }

    const existingNote = await Note.findOne({ _id: noteId, isDeleted: { $ne: true } });
    if (!existingNote) return res.status(404).json(errorResponse('Note not found.', 'Not Found', 404));
    const updates = {};
    if (Object.hasOwn(req.body || {}, 'title')) {
      const title = String(req.body.title || '').trim();
      if (title.length > 500) {
        return res.status(400).json(errorResponse('Note title must be 500 characters or fewer.', 'Bad Request', 400));
      }
      updates.customTitle = title;
    }
    if (Object.hasOwn(req.body || {}, 'isPublic')) {
      if (typeof req.body.isPublic !== 'boolean') {
        return res.status(400).json(errorResponse('isPublic must be a boolean.', 'Bad Request', 400));
      }
      updates.isPublic = req.body.isPublic;
    }
    if (Object.hasOwn(req.body || {}, 'accessType')) {
      if (!['free', 'paid'].includes(req.body.accessType)) {
        return res.status(400).json(errorResponse('accessType must be free or paid.', 'Bad Request', 400));
      }
      updates.accessType = req.body.accessType;
    }
    const requestedAccessType = updates.accessType || existingNote.accessType || 'free';
    if (Object.hasOwn(req.body || {}, 'pricePaise') || requestedAccessType === 'free') {
      const pricePaise = requestedAccessType === 'free' ? 0 : Number(req.body.pricePaise);
      if (!Number.isSafeInteger(pricePaise) || (requestedAccessType === 'paid' && pricePaise < 100)) {
        return res.status(400).json(errorResponse('Paid notes must have a price of at least ₹1.00, provided as integer paise.', 'Bad Request', 400));
      }
      updates.pricePaise = pricePaise;
    } else if (requestedAccessType === 'paid' && (!Number.isSafeInteger(existingNote.pricePaise) || existingNote.pricePaise < 100)) {
      return res.status(400).json(errorResponse('Set a valid price before marking this note as paid.', 'Bad Request', 400));
    }
    if (requestedAccessType === 'paid' && existingNote.storageType === 'driveLink') {
      return res.status(400).json(errorResponse('Google Drive links cannot be sold securely. Upload or create the note in the portal first.', 'Bad Request', 400));
    }
    if (Object.hasOwn(req.body || {}, 'folderId')) {
      const folder = await resolveFolder(req.body.folderId);
      Object.assign(updates, folderFields(folder));
      updates.folderMovedByAdmin = true;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json(errorResponse('Provide a note title, folder, visibility, access type, or price to update.', 'Bad Request', 400));
    }

    const note = await Note.findOneAndUpdate(
      { _id: noteId, isDeleted: { $ne: true } },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!note) return res.status(404).json(errorResponse('Note not found.', 'Not Found', 404));
    return res.status(200).json(successResponse('Note updated.', { note: sanitizeNote(note) }));
  } catch (error) {
    next(error);
  }
};

export const deleteAdminNote = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(noteId)) {
      return res.status(400).json(errorResponse('Invalid note id.', 'Bad Request', 400));
    }

    const note = await Note.findOne({ _id: noteId, isDeleted: { $ne: true } });
    if (!note) return res.status(404).json(errorResponse('Note not found.', 'Not Found', 404));

    if (note.storageType === 'gridfs' && note.gridFsFileId) {
      await getAcademicNoteBucket().delete(note.gridFsFileId);
      await note.deleteOne();
    } else if (note.storageType === 'mongodb' || note.storageType === 'driveLink') {
      await note.deleteOne();
    } else {
      note.isDeleted = true;
      note.isPublic = false;
      await note.save();
    }
    return res.status(200).json(successResponse('Note deleted.', { note: sanitizeNote(note) }));
  } catch (error) {
    next(error);
  }
};

export const getStudentNote = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(noteId)) {
      return res.status(400).json(errorResponse('Invalid note id.', 'Bad Request', 400));
    }

    const note = await Note.findOne({
      _id: noteId,
      isActive: true,
      isDeleted: { $ne: true },
      $or: [{ isPublic: true }, { isPublic: { $exists: false } }]
    });
    if (!note) {
      return res.status(404).json(errorResponse('Note not found.', 'Not Found', 404));
    }

    return res.status(200).json(successResponse('Note retrieved.', {
      note: { ...sanitizeNote(note), hasAccess: await studentHasNoteAccess(req.user.id, note) }
    }));
  } catch (error) {
    next(error);
  }
};

export const searchStudentNotesForAssistant = async (req, res, next) => {
  try {
    const query = String(req.query?.q || '').trim().slice(0, 100);
    const filter = {
      isActive: true,
      isDeleted: { $ne: true },
      $or: [{ isPublic: true }, { isPublic: { $exists: false } }]
    };
    if (query) {
      const expression = new RegExp(escapeRegex(query), 'i');
      filter.$and = [{
        $or: [
          { title: expression },
          { customTitle: expression },
          { originalName: expression },
          { category: expression },
          { folderPath: expression },
          { description: expression }
        ]
      }];
    }
    const notes = await Note.find(filter)
      .select('title customTitle originalName fileType mimeType storageType size category folderPath description createdAt accessType')
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();
    const purchasedIds = await getPurchasedNoteIds(req.user.id, notes);
    const accessibleNotes = notes.filter((note) => !noteIsPaid(note) || purchasedIds.has(String(note._id)));
    return res.status(200).json(successResponse('Published notes search completed.', {
      notes: accessibleNotes.map((note) => ({
        id: String(note._id),
        title: note.customTitle || note.title || note.originalName,
        fileType: note.fileType,
        mimeType: note.mimeType,
        storageType: note.storageType,
        size: note.size,
        category: note.category,
        folderPath: note.folderPath,
        description: note.description,
        createdAt: note.createdAt
      }))
    }));
  } catch (error) {
    next(error);
  }
};

export const readStudentNoteTextForAssistant = async (req, res, next) => {
  let pdf;
  try {
    if (!isValidObjectId(req.params.noteId)) {
      return res.status(400).json(errorResponse('Invalid note id.', 'Bad Request', 400));
    }
    const note = await Note.findOne({
      _id: req.params.noteId,
      isActive: true,
      isDeleted: { $ne: true },
      $or: [{ isPublic: true }, { isPublic: { $exists: false } }]
    });
    if (!note) return res.status(404).json(errorResponse('Note not found.', 'Not Found', 404));
    if (!(await studentHasNoteAccess(req.user.id, note))) {
      return res.status(402).json(errorResponse('Purchase this note to use it with the study assistant.', 'PaymentRequired', 402));
    }

    const fileName = note.customTitle || note.title || note.originalName || 'Note';
    if (note.storageType === 'driveLink') {
      return res.status(422).json(errorResponse('This item is a Google Drive link, not a portal-stored PDF. Open the shared link to read it.', 'Unprocessable Entity', 422));
    }
    if (note.storageType === 'mongodb') {
      const text = String(note.content || '').trim();
      if (!text) return res.status(422).json(errorResponse('This note has no readable text content.', 'Unprocessable Entity', 422));
      return res.status(200).json(successResponse('Published note text retrieved.', { fileName, pageCount: null, text: text.slice(0, 30000), truncated: text.length > 30000 }));
    }

    let buffer;
    let mimeType = note.viewMimeType || note.mimeType || '';
    if (note.storageType === 'gridfs') {
      const chunks = [];
      const stream = getAcademicNoteBucket().openDownloadStream(note.gridFsFileId);
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      buffer = Buffer.concat(chunks);
    } else if (note.storageType === 'googleDrive') {
      const result = await streamDriveFileContent(note);
      buffer = result.buffer;
      mimeType = result.mimeType || mimeType;
    } else {
      return res.status(422).json(errorResponse('This note uses an unsupported storage type for text reading.', 'Unprocessable Entity', 422));
    }

    if (note.fileType !== 'pdf' && mimeType !== 'application/pdf' && note.extension !== 'pdf') {
      return res.status(422).json(errorResponse('This item is not a PDF note.', 'Unprocessable Entity', 422));
    }
    try {
      pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
    } catch {
      return res.status(422).json(errorResponse('This PDF could not be read. It may be scanned, encrypted, or damaged.', 'Unprocessable Entity', 422));
    }

    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .filter((item) => 'str' in item && item.str.trim())
        .map((item) => item.str.trim())
        .join(' ');
      if (pageText) pages.push(pageText);
      page.cleanup();
    }
    const text = pages.join('\n\n');
    if (!text.trim()) {
      return res.status(422).json(errorResponse('This PDF has no selectable text. Scanned PDFs require OCR and cannot be read here.', 'Unprocessable Entity', 422));
    }
    return res.status(200).json(successResponse('Published PDF text extracted.', {
      fileName,
      pageCount: pdf.numPages,
      text: text.slice(0, 30000),
      truncated: text.length > 30000
    }));
  } catch (error) {
    next(error);
  } finally {
    if (pdf) {
      try { await pdf.destroy(); } catch { /* PDF cleanup is best-effort. */ }
    }
  }
};

export const streamStudentNote = async (req, res, next) => {
  try {
    const { noteId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(noteId)) {
      return res.status(400).json(errorResponse('Invalid note id.', 'Bad Request', 400));
    }

    const note = await Note.findOne({
      _id: noteId,
      isActive: true,
      isDeleted: { $ne: true },
      $or: [{ isPublic: true }, { isPublic: { $exists: false } }]
    });
    if (!note) {
      return res.status(404).json(errorResponse('Note not found.', 'Not Found', 404));
    }
    if (!(await studentHasNoteAccess(req.user.id, note))) {
      return res.status(402).json(errorResponse('Purchase this note before viewing or downloading it.', 'PaymentRequired', 402));
    }

    await streamNoteFile(note, res, next, 'inline');
  } catch (error) {
    next(error);
  }
};

export const streamDashboardNote = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.noteId)) {
      return res.status(400).json(errorResponse('Invalid note id.', 'Bad Request', 400));
    }
    const note = await Note.findOne({
      _id: req.params.noteId,
      isActive: true,
      isDeleted: { $ne: true },
      $or: [{ isPublic: true }, { isPublic: { $exists: false } }]
    });
    if (!note) return res.status(404).json(errorResponse('Shared note not found.', 'Not Found', 404));
    if (req.user.role === 'student' && !(await studentHasNoteAccess(req.user.id, note))) {
      return res.status(402).json(errorResponse('Purchase this note before viewing or downloading it.', 'PaymentRequired', 402));
    }
    await streamNoteFile(note, res, next, 'inline');
  } catch (error) {
    next(error);
  }
};

export const uploadAdminNotePdf = async (req, res, next) => {
  if (!req.file) return next(Object.assign(new Error('A PDF file is required.'), { statusCode: 400, name: 'MissingPdfFile' }));
  try {
    const signatureStream = getAcademicNoteBucket().openDownloadStream(req.file.gridFsFileId, { start: 0, end: 1024 });
    const signatureChunks = [];
    for await (const chunk of signatureStream) signatureChunks.push(Buffer.from(chunk));
    if (!Buffer.concat(signatureChunks).includes(Buffer.from('%PDF-'))) {
      throw Object.assign(new Error('The uploaded file does not contain a valid PDF signature.'), {
        statusCode: 400,
        name: 'InvalidPdfFile'
      });
    }
    const title = String(req.body?.title || req.file.originalFileName).trim();
    const folder = await resolveFolder(req.body?.folderId);
    const note = await Note.create({
      driveFileId: `gridfs:${req.file.gridFsFileId}`,
      storageType: 'gridfs',
      gridFsFileId: req.file.gridFsFileId,
      filename: req.file.filename,
      originalName: req.file.originalFileName,
      title,
      customTitle: '',
      fileType: 'pdf',
      mimeType: 'application/pdf',
      viewMimeType: 'application/pdf',
      extension: 'pdf',
      size: req.file.size,
      ...folderFields(folder),
      isActive: true,
      isPublic: parseVisibility(req.body?.isPublic),
      uploadedBy: req.user?.id
    });
    return res.status(201).json(successResponse('PDF uploaded to MongoDB GridFS.', { note: sanitizeNote(note) }));
  } catch (error) {
    try {
      await getAcademicNoteBucket().delete(req.file.gridFsFileId);
    } catch (cleanupError) {
      error.cleanupError = cleanupError.message;
      console.error('[Notes] Failed to remove a rejected PDF from GridFS:', cleanupError);
    }
    return next(error);
  }
};

export const createAdminNoteFile = async (req, res, next) => {
  try {
    const title = String(req.body?.title || '').trim();
    const content = typeof req.body?.content === 'string' ? req.body.content : '';
    const fileType = String(req.body?.fileType || 'markdown').toLowerCase();
    if (!title || title.length > 500) return res.status(400).json(errorResponse('A file name of 1 to 500 characters is required.', 'Bad Request', 400));
    if (/[\\/]/.test(title)) return res.status(400).json(errorResponse('File names cannot contain slashes.', 'Bad Request', 400));
    if (!['markdown', 'text'].includes(fileType)) return res.status(400).json(errorResponse('Created files must be text or Markdown.', 'Bad Request', 400));
    if (!content.trim()) return res.status(400).json(errorResponse('File content cannot be empty.', 'Bad Request', 400));
    if (Buffer.byteLength(content, 'utf8') > 1024 * 1024) return res.status(413).json(errorResponse('Text and Markdown files are limited to 1 MB.', 'Payload Too Large', 413));

    const extension = fileType === 'markdown' ? 'md' : 'txt';
    const existingExtension = path.extname(title).toLowerCase();
    if (existingExtension && existingExtension !== `.${extension}`) {
      return res.status(400).json(errorResponse(`The file name must end with .${extension} for the selected format.`, 'Bad Request', 400));
    }
    const normalizedTitle = existingExtension ? title : `${title}.${extension}`;
    const folder = await resolveFolder(req.body?.folderId);
    const note = await Note.create({
      driveFileId: `mongodb:${new mongoose.Types.ObjectId()}`,
      storageType: 'mongodb',
      filename: normalizedTitle,
      originalName: normalizedTitle,
      title: normalizedTitle,
      fileType: 'text',
      mimeType: fileType === 'markdown' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8',
      viewMimeType: fileType === 'markdown' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8',
      extension,
      content,
      size: Buffer.byteLength(content, 'utf8'),
      ...folderFields(folder),
      isPublic: parseVisibility(req.body?.isPublic),
      uploadedBy: req.user?.id
    });
    return res.status(201).json(successResponse('Text file created.', { note: sanitizeNote(note) }));
  } catch (error) {
    next(error);
  }
};

export const createAdminDriveLink = async (req, res, next) => {
  try {
    const title = String(req.body?.title || '').trim();
    const driveUrl = String(req.body?.driveUrl || '').trim();
    const description = String(req.body?.description || '').trim();
    if (!title || title.length > 500) return res.status(400).json(errorResponse('A document name of 1 to 500 characters is required.', 'Bad Request', 400));
    if (!driveLinkIsAllowed(driveUrl)) return res.status(400).json(errorResponse('Use a valid HTTPS Google Drive or Google Docs URL.', 'Bad Request', 400));
    if (description.length > 5000) return res.status(400).json(errorResponse('Description must be 5000 characters or fewer.', 'Bad Request', 400));
    if (/[\\/]/.test(title)) return res.status(400).json(errorResponse('Document names cannot contain slashes.', 'Bad Request', 400));
    const folder = await resolveFolder(req.body?.folderId);
    const note = await Note.create({
      driveFileId: `drive-link:${new mongoose.Types.ObjectId()}`,
      storageType: 'driveLink',
      filename: title,
      driveUrl,
      originalName: title,
      title,
      description,
      category: folder?.name || 'General',
      fileType: 'driveLink',
      mimeType: 'text/uri-list',
      extension: '',
      ...folderFields(folder),
      isPublic: parseVisibility(req.body?.isPublic),
      uploadedBy: req.user?.id
    });
    return res.status(201).json(successResponse('Google Drive link added.', { note: sanitizeNote(note) }));
  } catch (error) {
    next(error);
  }
};

export const createAdminNoteFolder = async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name || name.length > 200 || /[\\/]/.test(name)) {
      return res.status(400).json(errorResponse('Folder name must be 1 to 200 characters and cannot contain slashes.', 'Bad Request', 400));
    }
    const parent = await resolveFolder(req.body?.parentId);
    const folderPath = parent ? `${parent.path}/${name}` : name;
    let folder = await NoteFolder.findOne({ path: folderPath });
    if (folder?.isDeleted) {
      folder.name = name;
      folder.parentId = parent?._id || null;
      folder.source = 'admin';
      folder.sourcePath = undefined;
      folder.isDeleted = false;
      folder.createdBy = req.user?.id;
      await folder.save();
    } else if (folder) {
      return res.status(409).json(errorResponse('A folder with that name already exists here.', 'Conflict', 409));
    } else {
      folder = await NoteFolder.create({ name, parentId: parent?._id || null, path: folderPath, createdBy: req.user?.id });
    }
    return res.status(201).json(successResponse('Folder created.', { folder: sanitizeFolder(folder) }));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json(errorResponse('A folder with that name already exists here.', 'Conflict', 409));
    next(error);
  }
};

export const updateAdminNoteFolder = async (req, res, next) => {
  try {
    const { folderId } = req.params;
    if (!isValidObjectId(folderId)) return res.status(400).json(errorResponse('Invalid folder id.', 'Bad Request', 400));
    const folder = await NoteFolder.findOne({ _id: folderId, isDeleted: { $ne: true } });
    if (!folder) return res.status(404).json(errorResponse('Folder not found.', 'Not Found', 404));
    const name = String(req.body?.name || '').trim();
    if (!name || name.length > 200 || /[\\/]/.test(name)) return res.status(400).json(errorResponse('Folder name must be 1 to 200 characters and cannot contain slashes.', 'Bad Request', 400));
    const oldPath = folder.path;
    const parent = folder.parentId ? await NoteFolder.findById(folder.parentId) : null;
    const newPath = parent ? `${parent.path}/${name}` : name;
    const descendants = await NoteFolder.find({ path: new RegExp(`^${escapeRegex(oldPath)}/`), isDeleted: { $ne: true } }).sort({ path: 1 });
    const pathMap = new Map([[oldPath, newPath]]);
    folder.name = name;
    folder.path = newPath;
    await folder.save();
    for (const descendant of descendants) {
      const replacement = `${newPath}${descendant.path.slice(oldPath.length)}`;
      pathMap.set(descendant.path, replacement);
      descendant.path = replacement;
      await descendant.save();
    }
    const folderIds = [folder._id, ...descendants.map((descendant) => descendant._id)];
    const pathByFolderId = new Map([
      [String(folder._id), folder.path],
      ...descendants.map((descendant) => [String(descendant._id), descendant.path])
    ]);
    const affectedNotes = await Note.find({
      $or: [
        {
          folderId: { $in: folderIds },
          $or: [{ storageType: { $in: ['gridfs', 'mongodb', 'driveLink'] } }, { folderMovedByAdmin: true }]
        },
        { folderPath: new RegExp(`^${escapeRegex(oldPath)}(?:/|$)`) }
      ]
    });
    for (const note of affectedNotes) {
      const previousPath = note.folderPath || '';
      const folderPath = note.folderId ? pathByFolderId.get(String(note.folderId)) : '';
      note.folderPath = folderPath
        ? `Notes/${folderPath}`
        : pathMap.get(previousPath) || `${newPath}${previousPath.slice(oldPath.length)}`;
      note.folderPathSegments = note.folderPath.split('/');
      note.category = note.folderPathSegments.at(-1) || 'General';
      await note.save();
    }
    return res.status(200).json(successResponse('Folder renamed.', { folder: sanitizeFolder(folder) }));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json(errorResponse('A folder with that name already exists here.', 'Conflict', 409));
    next(error);
  }
};

export const deleteAdminNoteFolder = async (req, res, next) => {
  try {
    const { folderId } = req.params;
    if (!isValidObjectId(folderId)) return res.status(400).json(errorResponse('Invalid folder id.', 'Bad Request', 400));
    const folder = await NoteFolder.findOne({ _id: folderId, isDeleted: { $ne: true } });
    if (!folder) return res.status(404).json(errorResponse('Folder not found.', 'Not Found', 404));
    const [childFolders, descendantFolders] = await Promise.all([
      NoteFolder.countDocuments({ parentId: folder._id, isDeleted: { $ne: true } }),
      NoteFolder.find({ path: new RegExp(`^${escapeRegex(folder.path)}/`) }).select('_id').lean()
    ]);
    const folderIds = [folder._id, ...descendantFolders.map((child) => child._id)];
    const legacyDrivePath = folder.sourcePath ? new RegExp(`^${escapeRegex(folder.sourcePath)}(?:/|$)`) : new RegExp(`^${escapeRegex(folder.path)}(?:/|$)`);
    const childFiles = await Note.countDocuments({
      isDeleted: { $ne: true },
      $or: [{ folderId: { $in: folderIds } }, { folderPath: legacyDrivePath }]
    });
    if (childFolders || childFiles) return res.status(409).json(errorResponse('Move or delete the folder contents before deleting this folder.', 'Conflict', 409));
    if (folder.source === 'googleDrive' || folder.sourcePath) {
      folder.isDeleted = true;
      await folder.save();
    } else {
      await folder.deleteOne();
    }
    return res.status(200).json(successResponse('Folder deleted.', {}));
  } catch (error) {
    next(error);
  }
};

export const streamAdminNote = async (req, res, next) => {
  try {
    if (!isValidObjectId(req.params.noteId)) return res.status(400).json(errorResponse('Invalid note id.', 'Bad Request', 400));
    const note = await Note.findOne({ _id: req.params.noteId, isDeleted: { $ne: true } });
    if (!note) return res.status(404).json(errorResponse('Note not found.', 'Not Found', 404));
    if (note.storageType === 'driveLink') return res.redirect(302, note.driveUrl);
    await streamNoteFile(note, res, next, req.params.action === 'download' ? 'attachment' : 'inline');
  } catch (error) {
    next(error);
  }
};
