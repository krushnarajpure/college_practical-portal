import express from 'express';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { saveEvaluation, getEvaluations, getStudentEvaluations, getPracticalEvaluations } from '../controllers/evaluationController.js';

const router = express.Router();
router.use(authenticateUser);

router.post('/', requireRole('admin', 'teacher'), saveEvaluation);
router.get('/student/:studentId', requireRole('admin', 'teacher', 'student'), getStudentEvaluations);
router.get('/student', requireRole('student'), getStudentEvaluations);
router.get('/practical/:practicalId', requireRole('admin', 'teacher'), getPracticalEvaluations);
router.get('/', requireRole('admin', 'teacher', 'student'), getEvaluations);

export default router;
