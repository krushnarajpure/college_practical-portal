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

const router = express.Router();

router.use(authenticateUser, requireRole('teacher'));

router.get('/dashboard', getTeacherDashboard);
router.get('/subjects', getAssignedSubjects);
router.get('/subjects/available', getAvailableSubjects);
router.post('/subjects/create', createTeacherSubject);
router.post('/subjects', assignSubject);
router.get('/practicals', getTeacherPracticals);
router.post('/practicals', createPractical);
router.get('/practicals/:id', getPracticalById);
router.put('/practicals/:id', updatePractical);
router.delete('/practicals/:id', deletePractical);
router.post('/practicals/:id/publish', publishPractical);
router.post('/practicals/:id/unpublish', unpublishPractical);
router.post('/practicals/:id/analyze', analyzePractical);
router.get('/students', getTeacherStudents);

export default router;
