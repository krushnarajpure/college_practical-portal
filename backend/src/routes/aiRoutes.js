import express from 'express';
import { analyzePdfWithAi } from '../controllers/aiController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.post('/analyze', authenticateUser, requireRole('teacher', 'admin'), analyzePdfWithAi);

export default router;
