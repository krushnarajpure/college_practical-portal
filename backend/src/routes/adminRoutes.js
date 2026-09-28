import express from 'express';
import { getAdminDashboard, getDepartments, createDepartment, updateDepartment, deleteDepartment, getTeachers, createTeacher, updateTeacher, deleteTeacher, getStudents, getSubjects, getPracticals } from '../controllers/adminController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.use(authenticateUser, requireRole('admin'));

router.get('/dashboard', getAdminDashboard);
router.get('/departments', getDepartments);
router.post('/departments', createDepartment);
router.put('/departments/:id', updateDepartment);
router.delete('/departments/:id', deleteDepartment);
router.get('/teachers', getTeachers);
router.post('/teachers', createTeacher);
router.put('/teachers/:id', updateTeacher);
router.delete('/teachers/:id', deleteTeacher);
router.get('/students', getStudents);
router.get('/subjects', getSubjects);
router.get('/practicals', getPracticals);

export default router;
