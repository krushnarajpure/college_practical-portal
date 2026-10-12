import express from 'express';
import { getStudentDashboard, getStudentSubjects, getStudentPracticals, getStudentPracticalById, getStudentProfile, getStudentProfilePhoto, updateStudentProfile } from '../controllers/studentController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { requireVisiblePage } from '../middleware/pageVisibilityMiddleware.js';
import { profilePhotoUpload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(authenticateUser, requireRole('student'));

router.get('/dashboard', requireVisiblePage('dashboard'), getStudentDashboard);
router.get('/subjects', requireVisiblePage('subjects'), getStudentSubjects);
router.get('/practicals', requireVisiblePage('practicals'), getStudentPracticals);
router.get('/practicals/:practicalId', requireVisiblePage('practicals'), getStudentPracticalById);
router.get('/profile', requireVisiblePage('profile'), getStudentProfile);
router.get('/profile/photo', requireVisiblePage('profile'), getStudentProfilePhoto);
router.put('/profile', requireVisiblePage('profile'), profilePhotoUpload.single('photo'), updateStudentProfile);

export default router;
