import express from 'express';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { academicDocumentUpload } from '../middleware/academicDocumentUpload.js';
import {
  createAcademicDocument,
  createAiEdit,
  createManualEdit,
  convertAcademicDocument,
  deleteAcademicDocument,
  getAcademicDocument,
  getEligibleStudents,
  getEditableFields,
  getAiEditChanges,
  listAcademicDocuments,
  listStudentDocuments,
  listTeacherDocuments,
  reportUnsupportedEdit,
  streamAcademicDocument,
  previewManualEdit,
  updateAcademicDocument
} from '../controllers/academicDocumentController.js';

const router = express.Router();
router.use(authenticateUser);

router.get('/', requireRole('student', 'teacher', 'admin'), listAcademicDocuments);
router.get('/student', requireRole('student'), listStudentDocuments);
router.get('/teacher', requireRole('teacher', 'admin'), listTeacherDocuments);
router.post('/', requireRole('teacher', 'admin'), academicDocumentUpload.single('file'), createAcademicDocument);
router.get('/:id/students', requireRole('teacher', 'admin'), getEligibleStudents);
router.get('/:id/editable-fields', requireRole('student', 'teacher', 'admin'), getEditableFields);
router.get('/:id/versions/:versionId/file', requireRole('student', 'teacher', 'admin'), streamAcademicDocument);
router.get('/:id/preview', requireRole('student', 'teacher', 'admin'), streamAcademicDocument);
router.get('/:id/download', requireRole('student', 'teacher', 'admin'), streamAcademicDocument);
router.post('/:id/manual-edit/preview', requireRole('student', 'teacher', 'admin'), previewManualEdit);
router.post('/:id/manual-edit', requireRole('student', 'teacher', 'admin'), createManualEdit);
router.post('/:id/ai-edit/changes', requireRole('student', 'teacher', 'admin'), getAiEditChanges);
router.post('/:id/ai-edit', requireRole('student', 'teacher', 'admin'), createAiEdit);
router.post('/:id/convert/:format', requireRole('student'), convertAcademicDocument);
router.get('/:id', requireRole('student', 'teacher', 'admin'), getAcademicDocument);
router.put('/:id', requireRole('teacher', 'admin'), updateAcademicDocument);
router.delete('/:id', requireRole('teacher', 'admin'), deleteAcademicDocument);

export default router;