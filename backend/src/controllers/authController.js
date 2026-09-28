import mongoose from 'mongoose';
import User from '../models/User.js';
import Department from '../models/Department.js';
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
      departmentId,
      yearId,
      semesterId,
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

    if (role === 'student' && (!departmentId || !yearId || !semesterId || !validAcademicIds(departmentId, yearId, semesterId))) {
      return res.status(400).json(errorResponse('Department, year and semester are required for student registration.', 'Bad Request', 400));
    }

    if (role === 'student') {
      const [department, year, semester] = await Promise.all([
        Department.findOne({ _id: departmentId, status: 'active' }),
        Year.findOne({ _id: yearId, status: 'active' }),
        Semester.findOne({ _id: semesterId, status: 'active' })
      ]);

      if (!department || !year || !semester) {
        return res.status(400).json(errorResponse('Select an active department, year and semester.', 'Bad Request', 400));
      }
      if (String(semester.yearId) !== String(year._id)) {
        return res.status(400).json(errorResponse('Selected semester does not belong to the selected year.', 'Bad Request', 400));
      }
    }

    if (role === 'teacher' && departmentId && !mongoose.Types.ObjectId.isValid(departmentId)) {
      return res.status(400).json(errorResponse('A valid department is required for teachers.', 'Bad Request', 400));
    }

    if (role === 'teacher' && departmentId && !(await Department.exists({ _id: departmentId, status: 'active' }))) {
      return res.status(400).json(errorResponse('Select an active department for teachers.', 'Bad Request', 400));
    }

    const hashedPassword = await hashPassword(password);
    const user = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role,
      studentId: role === 'student' ? studentId.trim() : '',
      employeeId: role === 'teacher' ? employeeId.trim() : '',
      departmentId: role === 'student' || role === 'teacher' ? departmentId || null : null,
      yearId: role === 'student' ? yearId || null : null,
      semesterId: role === 'student' ? semesterId || null : null
    });

    const token = generateToken(user);
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
  const user = await User.findById(req.user.id).select('-password').populate(['departmentId', 'yearId', 'semesterId', 'assignedSubjects']);
  return res.status(200).json(successResponse('Current user fetched.', { user }));
};

export const forgotPassword = async (req, res) => {
  return res.status(200).json(successResponse('Password reset instructions sent.', {}));
};

export const resetPassword = async (req, res) => {
  return res.status(200).json(successResponse('Password reset successful.', {}));
};
