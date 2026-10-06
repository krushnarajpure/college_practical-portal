import express from 'express';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { deleteAdminNote, listAdminNotes, listStudentNotes, getStudentNote, streamStudentNote, syncNotesFromDrive, updateAdminNote } from '../controllers/noteController.js';
import { getAdminStorage } from '../controllers/adminController.js';

const router = express.Router();

router.use(authenticateUser);
router.get('/notes', requireRole('student'), listStudentNotes);
router.get('/student/notes', requireRole('student'), listStudentNotes);
router.get('/student/notes/:noteId', requireRole('student'), getStudentNote);
router.get('/student/notes/:noteId/view', requireRole('student'), streamStudentNote);
router.get('/admin/notes', requireRole('admin'), listAdminNotes);
router.put('/admin/notes/:noteId', requireRole('admin'), updateAdminNote);
router.delete('/admin/notes/:noteId', requireRole('admin'), deleteAdminNote);
router.post('/admin/notes/sync', requireRole('admin'), syncNotesFromDrive);
router.get('/admin/storage', requireRole('admin'), getAdminStorage);

export default router;
