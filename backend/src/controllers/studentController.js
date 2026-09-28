import mongoose from 'mongoose';
import User from '../models/User.js';
import Subject from '../models/Subject.js';
import Practical from '../models/Practical.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const academicFilterFromUser = async (userId) => {
  const user = await User.findById(userId).select('departmentId yearId semesterId');
  if (!user || !user.departmentId || !user.yearId || !user.semesterId) {
    return null;
  }
  return {
    departmentId: user.departmentId,
    yearId: user.yearId,
    semesterId: user.semesterId
  };
};

export const getStudentDashboard = async (req, res, next) => {
  try {
    const academicFilter = await academicFilterFromUser(req.user.id);
    if (!academicFilter) {
      return res.status(200).json(successResponse('Student dashboard loaded.', { stats: { subjects: 0, completed: 0, bookmarks: 0 }, subjects: [], practicals: [] }));
    }

    const [subjects, practicals] = await Promise.all([
      Subject.find({ ...academicFilter, status: { $ne: 'inactive' } }).sort({ name: 1 }),
      Practical.find({ ...academicFilter, status: 'published' }).populate(['subjectId', 'departmentId', 'yearId', 'semesterId']).sort({ practicalNumber: 1 })
    ]);

    return res.status(200).json(successResponse('Student dashboard loaded.', {
      stats: {
        subjects: subjects.length,
        completed: 0,
        bookmarks: 0
      },
      subjects,
      practicals
    }));
  } catch (error) {
    next(error);
  }
};

export const getStudentSubjects = async (req, res, next) => {
  try {
    const academicFilter = await academicFilterFromUser(req.user.id);
    if (!academicFilter) {
      return res.status(200).json(successResponse('Student subjects retrieved.', { subjects: [] }));
    }

    const subjects = await Subject.find({ ...academicFilter, status: { $ne: 'inactive' } }).sort({ name: 1 });
    return res.status(200).json(successResponse('Student subjects retrieved.', { subjects }));
  } catch (error) {
    next(error);
  }
};

export const getStudentPracticals = async (req, res, next) => {
  try {
    const academicFilter = await academicFilterFromUser(req.user.id);
    if (!academicFilter) {
      return res.status(200).json(successResponse('Student practicals retrieved.', { practicals: [] }));
    }

    const practicals = await Practical.find({ ...academicFilter, status: 'published' }).populate(['subjectId', 'departmentId', 'yearId', 'semesterId']).sort({ practicalNumber: 1 });
    return res.status(200).json(successResponse('Student practicals retrieved.', { practicals }));
  } catch (error) {
    next(error);
  }
};

export const getStudentPracticalById = async (req, res, next) => {
  try {
    const { practicalId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(practicalId)) {
      return res.status(400).json(errorResponse('Invalid practical id.', 'Bad Request', 400));
    }

    const academicFilter = await academicFilterFromUser(req.user.id);
    if (!academicFilter) {
      return res.status(403).json(errorResponse('Student academic mapping is missing.', 'Forbidden', 403));
    }

    const practical = await Practical.findOne({
      _id: practicalId,
      departmentId: academicFilter.departmentId,
      yearId: academicFilter.yearId,
      semesterId: academicFilter.semesterId,
      status: 'published'
    }).populate(['subjectId', 'departmentId', 'yearId', 'semesterId']);

    if (!practical) return res.status(404).json(errorResponse('Practical not found or not available for your academic mapping.', 'Not Found', 404));
    return res.status(200).json(successResponse('Student practical retrieved.', { practical }));
  } catch (error) {
    next(error);
  }
};

export const getStudentProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password').populate(['departmentId', 'yearId', 'semesterId']);
    return res.status(200).json(successResponse('Student profile retrieved.', { user }));
  } catch (error) {
    next(error);
  }
};
