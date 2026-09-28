import mongoose from 'mongoose';
import Practical from '../models/Practical.js';
import Subject from '../models/Subject.js';
import User from '../models/User.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const subjectPopulation = [
  { path: 'subjectId' },
  { path: 'departmentId' },
  { path: 'yearId' },
  { path: 'semesterId' }
];

const teacherSubjectsFilter = async (teacherId) => {
  const teacher = await User.findById(teacherId).select('departmentId assignedSubjects');
  const filter = { status: { $ne: 'inactive' } };
  if (teacher?.assignedSubjects?.length) filter._id = { $in: teacher.assignedSubjects };
  else if (teacher?.departmentId) filter.departmentId = teacher.departmentId;
  else filter._id = { $in: [] };
  return filter;
};

export const getTeacherDashboard = async (req, res, next) => {
  try {
    const subjectFilter = await teacherSubjectsFilter(req.user.id);
    const [subjects, practicals] = await Promise.all([
      Subject.find(subjectFilter).sort({ name: 1 }),
      Practical.find({ createdBy: req.user.id }).populate(subjectPopulation).sort({ updatedAt: -1 })
    ]);

    return res.status(200).json(successResponse('Teacher dashboard loaded.', {
      stats: {
        assignedSubjects: subjects.length,
        pendingReviews: practicals.filter((practical) => practical.status === 'draft').length,
        published: practicals.filter((practical) => practical.status === 'published').length
      },
      subjects,
      practicals
    }));
  } catch (error) {
    next(error);
  }
};

export const getAssignedSubjects = async (req, res, next) => {
  try {
    const filter = await teacherSubjectsFilter(req.user.id);
    const subjects = await Subject.find(filter).populate(['departmentId', 'yearId', 'semesterId']).sort({ name: 1 });
    return res.status(200).json(successResponse('Assigned subjects retrieved.', { subjects }));
  } catch (error) {
    next(error);
  }
};

export const getTeacherPracticals = async (req, res, next) => {
  try {
    const practicals = await Practical.find({ createdBy: req.user.id }).populate(subjectPopulation).sort({ updatedAt: -1 });
    return res.status(200).json(successResponse('Teacher practicals retrieved.', { practicals }));
  } catch (error) {
    next(error);
  }
};

export const createPractical = async (req, res, next) => {
  try {
    const {
      subjectId,
      departmentId,
      yearId,
      semesterId,
      practicalNumber,
      title,
      pdfId,
      aim = '',
      about = '',
      requirements = [],
      theory = '',
      procedure = [],
      task = '',
      expectedOutput = '',
      importantPoints = [],
      commonErrors = [],
      vivaQuestions = [],
      status = 'draft'
    } = req.body;

    if (!subjectId || !departmentId || !yearId || !semesterId || !practicalNumber || !title) {
      return res.status(400).json(errorResponse('Practical requires subjectId, departmentId, yearId, semesterId, practicalNumber and title.', 'Bad Request', 400));
    }

    const payload = {
      subjectId,
      departmentId,
      yearId,
      semesterId,
      practicalNumber,
      title,
      pdfId: pdfId || null,
      aim,
      about,
      requirements: Array.isArray(requirements) ? requirements : [requirements].filter(Boolean),
      theory,
      procedure: Array.isArray(procedure) ? procedure : [procedure].filter(Boolean),
      task,
      expectedOutput,
      importantPoints: Array.isArray(importantPoints) ? importantPoints : [importantPoints].filter(Boolean),
      commonErrors: Array.isArray(commonErrors) ? commonErrors : [commonErrors].filter(Boolean),
      vivaQuestions: Array.isArray(vivaQuestions) ? vivaQuestions : [vivaQuestions].filter(Boolean),
      status,
      createdBy: req.user.id
    };

    const practical = await Practical.create(payload);
    return res.status(201).json(successResponse('Practical created.', { practical }));
  } catch (error) {
    next(error);
  }
};

export const getPracticalById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(errorResponse('Invalid practical id.', 'Bad Request', 400));
    }

    const practical = await Practical.findById(id).populate(subjectPopulation);
    if (!practical) return res.status(404).json(errorResponse('Practical not found.', 'Not Found', 404));

    if (req.user.role !== 'admin' && String(practical.createdBy) !== String(req.user.id)) {
      return res.status(403).json(errorResponse('You are not allowed to view this practical.', 'Forbidden', 403));
    }

    return res.status(200).json(successResponse('Practical retrieved.', { practical }));
  } catch (error) {
    next(error);
  }
};

export const updatePractical = async (req, res, next) => {
  try {
    const practical = await Practical.findById(req.params.id);
    if (!practical) return res.status(404).json(errorResponse('Practical not found.', 'Not Found', 404));
    if (req.user.role !== 'admin' && String(practical.createdBy) !== String(req.user.id)) {
      return res.status(403).json(errorResponse('You are not allowed to update this practical.', 'Forbidden', 403));
    }

    const updated = await Practical.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).populate(subjectPopulation);
    return res.status(200).json(successResponse('Practical updated.', { practical: updated }));
  } catch (error) {
    next(error);
  }
};

export const deletePractical = async (req, res, next) => {
  try {
    const practical = await Practical.findById(req.params.id);
    if (!practical) return res.status(404).json(errorResponse('Practical not found.', 'Not Found', 404));
    if (req.user.role !== 'admin' && String(practical.createdBy) !== String(req.user.id)) {
      return res.status(403).json(errorResponse('You are not allowed to delete this practical.', 'Forbidden', 403));
    }

    await Practical.findByIdAndDelete(req.params.id);
    return res.status(200).json(successResponse('Practical deleted.', {}));
  } catch (error) {
    next(error);
  }
};

export const publishPractical = async (req, res, next) => {
  try {
    const practical = await Practical.findById(req.params.id);
    if (!practical) return res.status(404).json(errorResponse('Practical not found.', 'Not Found', 404));
    if (req.user.role !== 'admin' && String(practical.createdBy) !== String(req.user.id)) {
      return res.status(403).json(errorResponse('You are not allowed to publish this practical.', 'Forbidden', 403));
    }

    practical.status = 'published';
    practical.publishedAt = new Date();
    await practical.save();
    return res.status(200).json(successResponse('Practical published.', { practical }));
  } catch (error) {
    next(error);
  }
};

export const unpublishPractical = async (req, res, next) => {
  try {
    const practical = await Practical.findById(req.params.id);
    if (!practical) return res.status(404).json(errorResponse('Practical not found.', 'Not Found', 404));
    if (req.user.role !== 'admin' && String(practical.createdBy) !== String(req.user.id)) {
      return res.status(403).json(errorResponse('You are not allowed to unpublish this practical.', 'Forbidden', 403));
    }

    practical.status = 'draft';
    practical.publishedAt = null;
    await practical.save();
    return res.status(200).json(successResponse('Practical unpublished.', { practical }));
  } catch (error) {
    next(error);
  }
};

export const analyzePractical = async (req, res) => {
  return res.status(200).json(successResponse('Practical analysis started.', { analysis: req.body }));
};

export const getTeacherStudents = async (req, res, next) => {
  try {
    if (!req.user.departmentId) return res.status(200).json(successResponse('No department is assigned to this teacher.', { students: [] }));
    const students = await User.find({ role: 'student', departmentId: req.user.departmentId }).select('-password').populate(['departmentId', 'yearId', 'semesterId', 'assignedSubjects']).sort({ name: 1 });
    return res.status(200).json(successResponse('Teacher students retrieved.', { students }));
  } catch (error) {
    next(error);
  }
};
