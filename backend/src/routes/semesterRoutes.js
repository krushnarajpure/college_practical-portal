import express from 'express';
import { getAllSemesters, createSemester, updateSemester, deleteSemester } from '../controllers/semesterController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/', authenticateUser, requireRole('admin', 'teacher', 'student'), getAllSemesters);
router.post('/', authenticateUser, requireRole('admin'), createSemester);
router.put('/:id', authenticateUser, requireRole('admin'), updateSemester);
router.delete('/:id', authenticateUser, requireRole('admin'), deleteSemester);

export default router;
