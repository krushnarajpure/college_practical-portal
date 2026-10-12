import express from 'express';
import { getMyraaDashboard } from '../controllers/myraaController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { requireVisiblePage } from '../middleware/pageVisibilityMiddleware.js';

const router = express.Router();

router.use(authenticateUser, requireRole('student'));

router.get('/dashboard', requireVisiblePage('myraa'), getMyraaDashboard);

export default router;
