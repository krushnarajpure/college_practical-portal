import express from 'express';
import { getAllDepartments, createDepartment, updateDepartment, deleteDepartment } from '../controllers/departmentController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/', authenticateUser, requireRole('admin', 'teacher', 'student'), getAllDepartments);
router.post('/', authenticateUser, requireRole('admin'), createDepartment);
router.put('/:id', authenticateUser, requireRole('admin'), updateDepartment);
router.delete('/:id', authenticateUser, requireRole('admin'), deleteDepartment);

export default router;
