import mongoose from 'mongoose';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Program from '../models/Program.js';
import Year from '../models/Year.js';
import Semester from '../models/Semester.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import generateToken from '../utils/generateToken.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const validAcademicIds = (departmentId, yearId, semesterId) => {
  const values = [departmentId, yearId, semesterId].filter(Boolean);
  return values.every((value) => mongoose.Types.ObjectId.isValid(value));
};

export const registerUser = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role = 'student',
      programId,
      departmentId,
      yearId,
      semesterId,
      academicYear = '',
      studentId = '',
      employeeId = ''
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json(errorResponse('Name, email and password are required.', 'Bad Request', 400));
    }
    if (!['student', 'teacher'].includes(role)) {
      return res.status(403).json(errorResponse('Admin accounts can only be created by authorized college staff.', 'Forbidden', 403));
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json(errorResponse('User already exists.', 'Conflict', 409));
    }

    if (role === 'student' && (!programId || !departmentId || !yearId || !semesterId || !validAcademicIds(programId, departmentId, yearId, semesterId))) {
      return res.status(400).json(errorResponse('Course, branch, year and semester are required for student registration.', 'Bad Request', 400));
    }
    if (programId && !mongoose.Types.ObjectId.isValid(programId)) {
      return res.status(400).json(errorResponse('Select a valid course.', 'Bad Request', 400));
    }

    if (role === 'student') {
      const [department, year, semester, program] = await Promise.all([
        Department.findOne({ _id: departmentId, status: 'active' }),
        Year.findOne({ _id: yearId, status: 'active', programId }),
        Semester.findOne({ _id: semesterId, status: 'active' }),
        programId ? Program.findOne({ _id: programId, status: 'active' }) : null
      ]);

      if (!department || !year || !semester) {
        return res.status(400).json(errorResponse('Select an active department, year and semester.', 'Bad Request', 400));
      }
      if (!program || String(department.programId) !== String(program._id)) {
        return res.status(400).json(errorResponse('Select a branch belonging to the selected course.', 'Bad Request', 400));
      }
      if (String(semester.yearId) !== String(year._id)) {
        return res.status(400).json(errorResponse('Selected semester does not belong to the selected year.', 'Bad Request', 400));
      }
    }

    if (role === 'teacher' && (!programId || !departmentId || !validAcademicIds(programId, departmentId))) {
      return res.status(400).json(errorResponse('Select a course and branch for teachers.', 'Bad Request', 400));
    }

    if (role === 'teacher') {
      const department = await Department.findOne({ _id: departmentId, status: 'active' });
      if (!department) return res.status(400).json(errorResponse('Select an active department for teachers.', 'Bad Request', 400));
      if (String(department.programId) !== String(programId) || !(await Program.exists({ _id: programId, status: 'active' }))) {
        return res.status(400).json(errorResponse('Select a branch belonging to the selected course.', 'Bad Request', 400));
      }
    }

    const selectedDepartment = departmentId ? await Department.findById(departmentId).select('programId') : null;
    const hashedPassword = await hashPassword(password);
    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role,
      studentId: role === 'student' ? studentId.trim() : '',
      employeeId: role === 'teacher' ? employeeId.trim() : '',
      programId: programId || selectedDepartment?.programId || null,
      departmentId: role === 'student' || role === 'teacher' ? departmentId || null : null,
      yearId: role === 'student' ? yearId || null : null,
      semesterId: role === 'student' ? semesterId || null : null,
      academicYear: role === 'student' ? String(academicYear).trim() : ''
    });

    const token = generateToken(user);
    await user.populate(['programId', 'departmentId', 'yearId', 'semesterId']);
    const sanitizedUser = user.toObject();
    delete sanitizedUser.password;

    return res.status(201).json(successResponse('User registered successfully.', { user: sanitizedUser, token }));
  } catch (error) {
    next(error);
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
    if (!['student', 'teacher', 'admin'].includes(role)) {
      return res.status(400).json(errorResponse('Select a valid account role.', 'Bad Request', 400));
    }

    const user = await User.findOne({ email: String(email || '').trim().toLowerCase() });

    if (!user) {
      return res.status(401).json(errorResponse('Invalid credentials.', 'Unauthorized', 401));
    }

    const isValidPassword = await comparePassword(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json(errorResponse('Invalid credentials.', 'Unauthorized', 401));
    }

    if (user.role !== role) {
      return res.status(403).json(errorResponse('Selected role does not match this account.', 'Forbidden', 403));
    }

    const token = generateToken(user);
    await user.populate(['programId', 'departmentId', 'yearId', 'semesterId']);
    const sanitizedUser = user.toObject();
    delete sanitizedUser.password;

    return res.status(200).json(successResponse('Login successful.', { user: sanitizedUser, token }));
  } catch (error) {
    next(error);
  }
};

export const logoutUser = async (req, res) => {
  return res.status(200).json(successResponse('Logout successful.', {}));
};

export const getCurrentUser = async (req, res) => {
  const user = await User.findById(req.user.id).select('-password').populate(['programId', 'departmentId', 'yearId', 'semesterId', 'assignedSubjects']);
  return res.status(200).json(successResponse('Current user fetched.', { user }));
};

export const forgotPassword = async (req, res) => {
  return res.status(200).json(successResponse('Password reset instructions sent.', {}));
};

export const resetPassword = async (req, res) => {
  return res.status(200).json(successResponse('Password reset successful.', {}));
};
