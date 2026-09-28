import express from 'express';
import { getMyraaDashboard } from '../controllers/myraaController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(authenticateUser, requireRole('student'));

router.get('/dashboard', getMyraaDashboard);

export default router;
