import express from 'express';
import { createProgram, deleteProgram, listPrograms, updateProgram } from '../controllers/programController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/', authenticateUser, requireRole('admin', 'teacher', 'student'), listPrograms);
router.post('/', authenticateUser, requireRole('admin'), createProgram);
router.put('/:id', authenticateUser, requireRole('admin'), updateProgram);
router.delete('/:id', authenticateUser, requireRole('admin'), deleteProgram);

export default router;