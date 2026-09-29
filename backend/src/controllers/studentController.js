import mongoose from 'mongoose';
import User from '../models/User.js';
import Subject from '../models/Subject.js';
import Practical from '../models/Practical.js';
import Department from '../models/Department.js';
import Year from '../models/Year.js';
import Semester from '../models/Semester.js';
import { getProfilePhotoBucket } from '../config/storage.js';
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

const normalizeObjectId = (value) => {
  if (!value) return null;
  return String(value);
};

const deleteProfilePhotoFile = async (fileId) => {
  if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) return;
  try {
    const profilePhotoBucket = getProfilePhotoBucket();
    await profilePhotoBucket.delete(new mongoose.Types.ObjectId(fileId));
  } catch {
    // Ignore GridFS cleanup failures so the profile update still succeeds.
  }
};

const validateAcademicAssignment = async ({ departmentId, yearId, semesterId }) => {
  if (!departmentId || !yearId || !semesterId) {
    return { valid: false, message: 'Please select a valid active department, year and semester.' };
  }

  const [department, year, semester] = await Promise.all([
    Department.findOne({ _id: departmentId, status: 'active' }),
    Year.findOne({ _id: yearId, status: 'active' }),
    Semester.findOne({ _id: semesterId, status: 'active' })
  ]);

  if (!department || !year || !semester) {
    return { valid: false, message: 'Please select a valid active department.' };
  }

  if (String(semester.yearId) !== String(year._id)) {
    return { valid: false, message: 'Selected semester does not belong to the selected year.' };
  }

  return { valid: true };
};

export const getStudentProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password').populate(['departmentId', 'yearId', 'semesterId']);
    return res.status(200).json(successResponse('Student profile retrieved.', { user }));
  } catch (error) {
    next(error);
  }
};

export const getStudentProfilePhoto = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('profilePhotoId');
    if (!user?.profilePhotoId) {
      return res.status(404).json(errorResponse('No profile photo is available.', 'Not Found', 404));
    }

    const bucket = getProfilePhotoBucket();
    const file = await bucket.find({ _id: user.profilePhotoId }).next();
    if (!file) {
      return res.status(404).json(errorResponse('No profile photo is available.', 'Not Found', 404));
    }

    res.setHeader('Content-Type', file.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store');

    const downloadStream = bucket.openDownloadStream(user.profilePhotoId);
    downloadStream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json(errorResponse('Unable to load profile photo.', 'Internal Server Error', 500));
      }
    });
    downloadStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export const updateStudentProfile = async (req, res, next) => {
  try {
    const body = req.body || {};
    const trimmedName = String(body.name || '').trim();
    const trimmedStudentId = String(body.studentId || '').trim();
    const departmentId = normalizeObjectId(body.departmentId);
    const yearId = normalizeObjectId(body.yearId);
    const semesterId = normalizeObjectId(body.semesterId);
    const removePhoto = body.removePhoto === true || body.removePhoto === 'true';

    if (!trimmedName || trimmedName.length < 2) {
      return res.status(400).json(errorResponse('Please enter a valid full name.', 'Bad Request', 400));
    }

    if (!trimmedStudentId) {
      return res.status(400).json(errorResponse('Student ID / roll number is required.', 'Bad Request', 400));
    }

    if (!departmentId || !yearId || !semesterId) {
      return res.status(400).json(errorResponse('Please select a valid active department, year and semester.', 'Bad Request', 400));
    }

    const academicValidation = await validateAcademicAssignment({ departmentId, yearId, semesterId });
    if (!academicValidation.valid) {
      return res.status(400).json(errorResponse(academicValidation.message, 'Bad Request', 400));
    }

    const duplicateStudent = await User.findOne({ studentId: trimmedStudentId, _id: { $ne: req.user.id } });
    if (duplicateStudent) {
      return res.status(409).json(errorResponse('This student ID / roll number is already in use.', 'Conflict', 409));
    }

    const currentUser = await User.findById(req.user.id).select('profilePhotoId');
    let nextProfilePhotoId = currentUser?.profilePhotoId || null;

    if (removePhoto) {
      if (currentUser?.profilePhotoId) {
        await deleteProfilePhotoFile(currentUser.profilePhotoId);
      }
      nextProfilePhotoId = null;
    } else if (req.file && req.file.id) {
      if (currentUser?.profilePhotoId && String(currentUser.profilePhotoId) !== String(req.file.id)) {
        await deleteProfilePhotoFile(currentUser.profilePhotoId);
      }
      nextProfilePhotoId = req.file.id;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name: trimmedName,
        studentId: trimmedStudentId,
        departmentId,
        yearId,
        semesterId,
        profilePhotoId: nextProfilePhotoId
      },
      { new: true, runValidators: true }
    ).select('-password').populate(['departmentId', 'yearId', 'semesterId']);

    if (!user) return res.status(404).json(errorResponse('Student not found.', 'Not Found', 404));
    return res.status(200).json(successResponse('Profile updated successfully', { user }));
  } catch (error) {
    next(error);
  }
};
