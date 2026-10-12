import express from 'express';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { upload } from '../middleware/uploadMiddleware.js';
import { requireVisiblePage } from '../middleware/pageVisibilityMiddleware.js';
import { createSubmission, getStudentSubmissions, getSubmissions, getPracticalSubmissions, getSubmissionFile } from '../controllers/submissionController.js';

const router = express.Router();
router.use(authenticateUser);

router.post('/', requireRole('student'), requireVisiblePage('practicals'), upload.single('file'), createSubmission);
router.get('/student', requireRole('student'), requireVisiblePage('practicals'), getStudentSubmissions);
router.get('/practical/:practicalId', requireRole('admin', 'teacher'), requireVisiblePage('practicals'), getPracticalSubmissions);
router.get('/', requireRole('admin', 'teacher'), requireVisiblePage('practicals'), getSubmissions);
router.get('/:id/file', requireRole('admin', 'teacher', 'student'), requireVisiblePage('practicals'), getSubmissionFile);

export default router;
