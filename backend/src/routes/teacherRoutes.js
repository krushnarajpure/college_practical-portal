import express from 'express';
import {
  getTeacherDashboard,
  getAssignedSubjects,
  getAvailableSubjects,
  assignSubject,
  createTeacherSubject,
  getTeacherStudents
} from '../controllers/teacherController.js';
import {
  getTeacherPracticals,
  createPractical,
  getPracticalById,
  updatePractical,
  deletePractical,
  publishPractical,
  unpublishPractical,
  analyzePractical
} from '../controllers/practicalController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { requireVisiblePage } from '../middleware/pageVisibilityMiddleware.js';

const router = express.Router();

router.use(authenticateUser, requireRole('teacher'));

router.get('/dashboard', requireVisiblePage('dashboard'), getTeacherDashboard);
router.get('/subjects', requireVisiblePage('subjects'), getAssignedSubjects);
router.get('/subjects/available', requireVisiblePage('subjects'), getAvailableSubjects);
router.post('/subjects/create', requireVisiblePage('subjects'), createTeacherSubject);
router.post('/subjects', requireVisiblePage('subjects'), assignSubject);
router.get('/practicals', requireVisiblePage('practicals'), getTeacherPracticals);
router.post('/practicals', requireVisiblePage('practicals'), createPractical);
router.get('/practicals/:id', requireVisiblePage('practicals'), getPracticalById);
router.put('/practicals/:id', requireVisiblePage('practicals'), updatePractical);
router.delete('/practicals/:id', requireVisiblePage('practicals'), deletePractical);
router.post('/practicals/:id/publish', requireVisiblePage('practicals'), publishPractical);
router.post('/practicals/:id/unpublish', requireVisiblePage('practicals'), unpublishPractical);
router.post('/practicals/:id/analyze', requireVisiblePage('practicals'), analyzePractical);
router.get('/students', requireVisiblePage('students'), getTeacherStudents);

export default router;
