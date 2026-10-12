import express from 'express';
import { listPageSettings, updatePageSetting } from '../controllers/pageSettingController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(authenticateUser);
router.get('/', requireRole('admin', 'teacher', 'student'), listPageSettings);
router.put('/', requireRole('admin'), updatePageSetting);

export default router;