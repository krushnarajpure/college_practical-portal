import express from 'express';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import {
  createAdminDriveLink,
  createAdminNoteFile,
  createAdminNoteFolder,
  deleteAdminNote,
  deleteAdminNoteFolder,
  listAdminNotes,
  listAdminNoteFolders,
  listDashboardNotes,
  listStudentNotes,
  getStudentNote,
  readStudentNoteTextForAssistant,
  searchStudentNotesForAssistant,
  streamAdminNote,
  streamDashboardNote,
  streamStudentNote,
  syncNotesFromDrive,
  updateAdminNote,
  updateAdminNoteFolder,
  uploadAdminNotePdf
} from '../controllers/noteController.js';
import { getAdminStorage } from '../controllers/adminController.js';
import { notePdfUpload } from '../middleware/noteUploadMiddleware.js';
import { createNotePaymentOrder, verifyNotePayment } from '../controllers/notePaymentController.js';

const router = express.Router();

router.use(authenticateUser);
router.get('/notes', requireRole('student'), listStudentNotes);
router.get('/student/notes', requireRole('student'), listStudentNotes);
router.get('/student/notes/assistant/search', requireRole('student'), searchStudentNotesForAssistant);
router.post('/notes/payments/orders', requireRole('student'), createNotePaymentOrder);
router.post('/notes/payments/verify', requireRole('student'), verifyNotePayment);
router.get('/student/notes/:noteId/text', requireRole('student'), readStudentNoteTextForAssistant);
router.get('/student/notes/:noteId', requireRole('student'), getStudentNote);
router.get('/student/notes/:noteId/view', requireRole('student'), streamStudentNote);
router.get('/dashboard/notes', requireRole('student', 'teacher'), listDashboardNotes);
router.get('/dashboard/notes/:noteId/view', requireRole('student', 'teacher'), streamDashboardNote);
router.get('/admin/notes', requireRole('admin'), listAdminNotes);
router.get('/admin/folders', requireRole('admin'), listAdminNoteFolders);
router.post('/admin/notes/upload', requireRole('admin'), notePdfUpload.single('pdf'), uploadAdminNotePdf);
router.post('/admin/notes/files', requireRole('admin'), createAdminNoteFile);
router.post('/admin/notes/drive-link', requireRole('admin'), createAdminDriveLink);
router.get('/admin/notes/:noteId/view', requireRole('admin'), streamAdminNote);
router.get('/admin/notes/:noteId/download', requireRole('admin'), streamAdminNote);
router.put('/admin/notes/:noteId', requireRole('admin'), updateAdminNote);
router.delete('/admin/notes/:noteId', requireRole('admin'), deleteAdminNote);
router.post('/admin/notes/sync', requireRole('admin'), syncNotesFromDrive);
router.post('/admin/folders', requireRole('admin'), createAdminNoteFolder);
router.put('/admin/folders/:folderId', requireRole('admin'), updateAdminNoteFolder);
router.delete('/admin/folders/:folderId', requireRole('admin'), deleteAdminNoteFolder);
router.get('/admin/storage', requireRole('admin'), getAdminStorage);

export default router;
