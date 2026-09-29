import express from 'express';
import { getStudentDashboard, getStudentSubjects, getStudentPracticals, getStudentPracticalById, getStudentProfile, getStudentProfilePhoto, updateStudentProfile } from '../controllers/studentController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { profilePhotoUpload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(authenticateUser, requireRole('student'));

router.get('/dashboard', getStudentDashboard);
router.get('/subjects', getStudentSubjects);
router.get('/practicals', getStudentPracticals);
router.get('/practicals/:practicalId', getStudentPracticalById);
router.get('/profile', getStudentProfile);
router.get('/profile/photo', getStudentProfilePhoto);
router.put('/profile', profilePhotoUpload.single('photo'), updateStudentProfile);

export default router;
