import { successResponse } from '../utils/apiResponse.js';
import Department from '../models/Department.js';
import Year from '../models/Year.js';
import Semester from '../models/Semester.js';
import Subject from '../models/Subject.js';
import User from '../models/User.js';
import Practical from '../models/Practical.js';

export const getAdminDashboard = async (req, res) => {
  const [departments, subjects, students, practicals] = await Promise.all([
    Department.countDocuments(),
    Subject.countDocuments(),
    User.countDocuments({ role: 'student' }),
    Practical.countDocuments()
  ]);

  return res.status(200).json(successResponse('Admin dashboard data loaded.', {
    stats: { departments, subjects, students, practicals }
  }));
};

export const getDepartments = async (req, res) => {
  const departments = await Department.find().sort({ name: 1 });
  return res.status(200).json(successResponse('Departments retrieved.', { departments }));
};

export const createDepartment = async (req, res) => {
  const department = await Department.create({ ...req.body, status: req.body.status || 'active' });
  return res.status(201).json(successResponse('Department created.', { department }));
};

export const updateDepartment = async (req, res) => {
  const department = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  return res.status(200).json(successResponse('Department updated.', { department }));
};

export const deleteDepartment = async (req, res) => {
  await Department.findByIdAndDelete(req.params.id);
  return res.status(200).json(successResponse('Department deleted.', {}));
};

export const getTeachers = async (req, res) => {
  const teachers = await User.find({ role: 'teacher' }).select('-password').populate(['departmentId', 'assignedSubjects']).sort({ name: 1 });
  return res.status(200).json(successResponse('Teachers retrieved.', { teachers }));
};

export const createTeacher = async (req, res) => {
  return res.status(201).json(successResponse('Teacher created.', { teacher: req.body }));
};

export const updateTeacher = async (req, res) => {
  return res.status(200).json(successResponse('Teacher updated.', { teacher: req.body }));
};

export const deleteTeacher = async (req, res) => {
  return res.status(200).json(successResponse('Teacher deleted.', {}));
};

export const getStudents = async (req, res) => {
  const students = await User.find({ role: 'student' }).select('-password').populate(['departmentId', 'yearId', 'semesterId', 'assignedSubjects']).sort({ name: 1 });
  return res.status(200).json(successResponse('Students retrieved.', { students }));
};

export const getSubjects = async (req, res) => {
  const subjects = await Subject.find().populate(['departmentId', 'yearId', 'semesterId']).sort({ name: 1 });
  return res.status(200).json(successResponse('Subjects retrieved.', { subjects }));
};

export const getPracticals = async (req, res) => {
  const practicals = await Practical.find().populate(['subjectId', 'departmentId', 'yearId', 'semesterId']).sort({ updatedAt: -1 });
  return res.status(200).json(successResponse('Practicals retrieved.', { practicals }));
};
