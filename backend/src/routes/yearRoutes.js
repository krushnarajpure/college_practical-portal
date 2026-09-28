import express from 'express';
import { getAllYears, createYear, updateYear, deleteYear } from '../controllers/yearController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/', authenticateUser, requireRole('admin', 'teacher'), getAllYears);
router.post('/', authenticateUser, requireRole('admin'), createYear);
router.put('/:id', authenticateUser, requireRole('admin'), updateYear);
router.delete('/:id', authenticateUser, requireRole('admin'), deleteYear);

export default router;
