import express from 'express';
import { deletePdf, downloadPdf, getPdfById, getStudentPdfText, preparePdfUpload, uploadPdf, viewPdf } from '../controllers/pdfController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/upload', authenticateUser, requireRole('teacher', 'admin'), upload.single('pdf'), preparePdfUpload, uploadPdf);
router.get('/:id/view', authenticateUser, viewPdf);
router.get('/:id/download', authenticateUser, downloadPdf);
router.delete('/:id', authenticateUser, requireRole('teacher', 'admin'), deletePdf);
router.get('/:id/text', authenticateUser, requireRole('student'), getStudentPdfText);
router.get('/:id', authenticateUser, getPdfById);

export default router;
