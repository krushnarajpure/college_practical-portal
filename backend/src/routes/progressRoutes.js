import express from 'express';
import { getProgress, markComplete, removeComplete } from '../controllers/progressController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(authenticateUser, requireRole('student'));

router.get('/', getProgress);
router.post('/:practicalId/complete', markComplete);
router.delete('/:practicalId/complete', removeComplete);

export default router;
