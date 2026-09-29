import express from 'express';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { createSubmission, getStudentSubmissions, getSubmissions, getPracticalSubmissions, getSubmissionFile } from '../controllers/submissionController.js';

const router = express.Router();
router.use(authenticateUser);

router.post('/', requireRole('student'), upload.single('file'), createSubmission);
router.get('/student', requireRole('student'), getStudentSubmissions);
router.get('/practical/:practicalId', requireRole('admin', 'teacher'), getPracticalSubmissions);
router.get('/', requireRole('admin', 'teacher'), getSubmissions);
router.get('/:id/file', requireRole('admin', 'teacher', 'student'), getSubmissionFile);

export default router;
