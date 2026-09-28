import express from 'express';
import { getAllSubjects, getSubjectById, createSubject, updateSubject, deleteSubject, getStudentSubjects, getSubjectPracticals } from '../controllers/subjectController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/student/subjects', authenticateUser, requireRole('student'), getStudentSubjects);
router.get('/:subjectId/practicals', authenticateUser, getSubjectPracticals);
router.get('/', authenticateUser, getAllSubjects);
router.get('/:id', authenticateUser, getSubjectById);
router.post('/', authenticateUser, requireRole('admin'), createSubject);
router.put('/:id', authenticateUser, requireRole('admin'), updateSubject);
router.delete('/:id', authenticateUser, requireRole('admin'), deleteSubject);

export default router;
