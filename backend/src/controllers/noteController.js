import mongoose from 'mongoose';
import Note from '../models/Note.js';
import { streamDriveFileContent, syncGoogleDriveNotes } from '../services/googleDriveNoteService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const sanitizeNote = (note) => {
  const dto = note.toObject ? note.toObject() : { ...note };
  const id = String(dto._id);
  return {
    ...dto,
    title: dto.customTitle || dto.title,
    id,
    _id: id,
    driveFileId: undefined,
    driveUrl: undefined,
    viewerUrl: `/api/student/notes/${id}/view`
  };
};

export const syncNotesFromDrive = async (_req, res, next) => {
  try {
    const result = await syncGoogleDriveNotes();
    return res.status(200).json(successResponse('Notes synced from Google Drive.', result));
  } catch (error) {
    next(error);
  }
};

export const listStudentNotes = async (_req, res, next) => {
  try {
    let syncSummary;
    let syncError = null;
    try {
      syncSummary = await syncGoogleDriveNotes();
    } catch (error) {
      console.error('[Notes] Google Drive sync failed:', error);
      const driveError = error.response?.data?.error;
      const disabledDriveApi = driveError?.details?.some(
        (detail) => detail.reason === 'SERVICE_DISABLED' && detail.metadata?.service === 'drive.googleapis.com'
      );
      if (disabledDriveApi) {
        const activationUrl = driveError.details.find((detail) => detail.metadata?.activationUrl)?.metadata.activationUrl;
        syncError = `Google Drive API is disabled for the service-account project. Enable it in Google Cloud Console${activationUrl ? `: ${activationUrl}` : ''}, wait a few minutes, then retry.`;
      } else {
        syncError = `Google Drive sync failed${error.message ? `: ${error.message}` : '. Previously synced notes are still available; check Drive credentials and folder access.'}`;
      }
    }

    const notes = await Note.find({
      isActive: true,
      isDeleted: { $ne: true },
      $or: [{ isPublic: true }, { isPublic: { $exists: false } }]
    }).sort({ updatedAt: -1 });
    if (syncError && notes.length === 0) {
      return res.status(503).json(errorResponse(
        syncError,
        'GoogleDriveSyncFailed',
        503
      ));
    }

    const categoryCounts = notes.reduce((counts, note) => {
      const category = note.category || 'General';
      counts[category] = (counts[category] || 0) + 1;
      return counts;
    }, {});
    return res.status(200).json(successResponse('Student notes retrieved.', {
      notes: notes.map(sanitizeNote),
      totalNotes: notes.length,
      categoryCounts,
      syncSummary,
      syncError
    }));
  } catch (error) {
    next(error);
  }
};

export const listAdminNotes = async (_req, res, next) => {
  try {
    const notes = await Note.find().sort({ isActive: -1, updatedAt: -1 });
    const totalNotes = notes.length;
    const activeNotes = notes.filter((note) => note.isActive && !note.isDeleted);
    const publicNotes = activeNotes.filter((note) => note.isPublic === true || note.isPublic === undefined);

    return res.status(200).json(successResponse('Notes administration data retrieved.', {
      notes: notes.map(sanitizeNote),
      stats: {
        totalNotes,
        activeNotes: activeNotes.length,
        publicNotes: publicNotes.length,
        privateNotes: activeNotes.length - publicNotes.length,
        deletedNotes: notes.filter((note) => note.isDeleted).length,
        googleDriveBytes: activeNotes.reduce((total, note) => total + Number(note.size || 0), 0)
      }
    }));
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

    if (!Object.keys(updates).length) {
      return res.status(400).json(errorResponse('Provide a note title or public visibility to update.', 'Bad Request', 400));
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

    const note = await Note.findOneAndUpdate(
      { _id: noteId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, isPublic: false } },
      { new: true }
    );
    if (!note) return res.status(404).json(errorResponse('Note not found.', 'Not Found', 404));

    return res.status(200).json(successResponse('Note removed from the portal.', { note: sanitizeNote(note) }));
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

    return res.status(200).json(successResponse('Note retrieved.', { note: sanitizeNote(note) }));
  } catch (error) {
    next(error);
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

    const { buffer, mimeType } = await streamDriveFileContent(note);
    const safeFileName = String(note.title || 'note').replace(/[\\/:*?"<>|\r\n]/g, '_');

    res.setHeader('Content-Type', mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.status(200).send(buffer);
  } catch (error) {
    next(error);
  }
};
