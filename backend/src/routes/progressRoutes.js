import express from 'express';
import { getProgress, markComplete, removeComplete } from '../controllers/progressController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { requireVisiblePage } from '../middleware/pageVisibilityMiddleware.js';

const router = express.Router();

router.use(authenticateUser, requireRole('student'));

router.get('/', requireVisiblePage('practicals'), getProgress);
router.post('/:practicalId/complete', requireVisiblePage('practicals'), markComplete);
router.delete('/:practicalId/complete', requireVisiblePage('practicals'), removeComplete);

export default router;
