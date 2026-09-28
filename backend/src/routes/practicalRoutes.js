import express from 'express';
import { getAllPracticals, getPracticalById, createPractical, updatePractical, deletePractical, publishPractical, unpublishPractical, analyzePractical } from '../controllers/practicalController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/', authenticateUser, getAllPracticals);
router.get('/:id', authenticateUser, getPracticalById);
router.post('/', authenticateUser, requireRole('teacher', 'admin'), createPractical);
router.put('/:id', authenticateUser, requireRole('teacher', 'admin'), updatePractical);
router.delete('/:id', authenticateUser, requireRole('teacher', 'admin'), deletePractical);
router.post('/:id/publish', authenticateUser, requireRole('teacher', 'admin'), publishPractical);
router.post('/:id/unpublish', authenticateUser, requireRole('teacher', 'admin'), unpublishPractical);
router.post('/:id/analyze', authenticateUser, requireRole('teacher'), analyzePractical);

export default router;
