import express from 'express';
import { getBookmarks, addBookmark, removeBookmark } from '../controllers/bookmarkController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { requireVisiblePage } from '../middleware/pageVisibilityMiddleware.js';

const router = express.Router();

router.use(authenticateUser, requireRole('student'));

router.get('/', requireVisiblePage('bookmarks'), getBookmarks);
router.post('/:practicalId', requireVisiblePage('bookmarks'), addBookmark);
router.delete('/:practicalId', requireVisiblePage('bookmarks'), removeBookmark);

export default router;
