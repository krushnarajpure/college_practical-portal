import express from 'express';
import { getBookmarks, addBookmark, removeBookmark } from '../controllers/bookmarkController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(authenticateUser, requireRole('student'));

router.get('/', getBookmarks);
router.post('/:practicalId', addBookmark);
router.delete('/:practicalId', removeBookmark);

export default router;
