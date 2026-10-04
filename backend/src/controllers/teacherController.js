import mongoose from 'mongoose';
import Practical from '../models/Practical.js';
import Subject from '../models/Subject.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Year from '../models/Year.js';
import Semester from '../models/Semester.js';
import notificationService from '../services/notificationService.js';
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
  const accessRules = [];
  if (teacher?.assignedSubjects?.length) accessRules.push({ _id: { $in: teacher.assignedSubjects } });
  if (teacher?.departmentId) accessRules.push({ departmentId: teacher.departmentId });
  if (accessRules.length) filter.$or = accessRules;
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

export const getAvailableSubjects = async (req, res, next) => {
  try {
    const teacher = await User.findById(req.user.id).select('status assignedSubjects');
    if (!teacher || teacher.status !== 'active') {
      return res.status(403).json(errorResponse('Account is unavailable.', 'Forbidden', 403));
    }

    const subjects = await Subject.find({
      _id: { $nin: teacher.assignedSubjects || [] },
      status: { $ne: 'inactive' },
      ...(teacher.departmentId ? { departmentId: { $ne: teacher.departmentId } } : {})
    }).populate(['departmentId', 'yearId', 'semesterId']).sort({ name: 1 });

    return res.status(200).json(successResponse('Available subjects retrieved.', { subjects }));
  } catch (error) {
    next(error);
  }
};

export const assignSubject = async (req, res, next) => {
  try {
    const { subjectId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json(errorResponse('Select a valid subject.', 'Bad Request', 400));
    }

    const [teacher, subject] = await Promise.all([
      User.findById(req.user.id).select('name status departmentId assignedSubjects'),
      Subject.findOne({ _id: subjectId, status: { $ne: 'inactive' } })
    ]);
    if (!teacher || teacher.status !== 'active') {
      return res.status(403).json(errorResponse('Account is unavailable.', 'Forbidden', 403));
    }
    if (!subject) {
      return res.status(404).json(errorResponse('Active subject not found.', 'Not Found', 404));
    }

    await Promise.all([
      User.updateOne({ _id: teacher._id }, { $addToSet: { assignedSubjects: subject._id } }),
      Subject.updateOne({ _id: subject._id }, { $addToSet: { assignedTeachers: teacher._id } })
    ]);
    const [department, year, semester] = await Promise.all([
      Department.findById(subject.departmentId).select('name'),
      Year.findById(subject.yearId).select('name'),
      Semester.findById(subject.semesterId).select('name')
    ]);
    await notificationService.createAdminActivity({
      actorId: teacher._id,
      action: 'subject_assigned',
      entityType: 'subject',
      entityId: subject._id,
      message: `${teacher.name} added ${subject.name} (${department?.name || 'Department'} · ${year?.name || 'Year'} · ${semester?.name || 'Semester'}) to their teaching subjects.`
    });

    const subjects = await Subject.find(await teacherSubjectsFilter(teacher._id))
      .populate(['departmentId', 'yearId', 'semesterId'])
      .sort({ name: 1 });
    return res.status(200).json(successResponse('Subject added to your assignments.', { subjects }));
  } catch (error) {
    next(error);
  }
};

export const createTeacherSubject = async (req, res, next) => {
  try {
    const { name, subjectCode, description = '', departmentId, yearId, semesterId } = req.body;
    if (!String(name || '').trim() || !departmentId || !yearId || !semesterId) {
      return res.status(400).json(errorResponse('Subject name, department, year and semester are required.', 'Bad Request', 400));
    }
    if (![departmentId, yearId, semesterId].every((id) => mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json(errorResponse('Select valid department, year and semester records.', 'Bad Request', 400));
    }

    const [teacher, department, year, semester] = await Promise.all([
      User.findById(req.user.id).select('name status'),
      Department.findOne({ _id: departmentId, status: 'active' }),
      Year.findOne({ _id: yearId, status: 'active' }),
      Semester.findOne({ _id: semesterId, status: 'active' })
    ]);
    if (!teacher || teacher.status !== 'active') {
      return res.status(403).json(errorResponse('Account is unavailable.', 'Forbidden', 403));
    }
    if (!department || !year || !semester || String(semester.yearId) !== String(year._id)) {
      return res.status(400).json(errorResponse('Select an active department, year and semester that belong together.', 'Bad Request', 400));
    }

    const subject = await Subject.create({
      name: String(name).trim(),
      subjectCode: String(subjectCode || name).trim().toUpperCase(),
      description: String(description || '').trim(),
      departmentId: department._id,
      yearId: year._id,
      semesterId: semester._id,
      assignedTeachers: [teacher._id],
      status: 'active'
    });

    try {
      const assignment = await User.updateOne(
        { _id: teacher._id, status: 'active' },
        { $addToSet: { assignedSubjects: subject._id } }
      );
      if (assignment.matchedCount !== 1) {
        throw new Error('Teacher account is unavailable.');
      }
    } catch (error) {
      await Subject.findByIdAndDelete(subject._id);
      throw error;
    }

    await notificationService.createAdminActivity({
      actorId: teacher._id,
      action: 'subject_created',
      entityType: 'subject',
      entityId: subject._id,
      message: `${teacher.name} created subject ${subject.name} (${department.name} · ${year.name} · ${semester.name})${subject.subjectCode ? `, code ${subject.subjectCode}` : ''}.`
    });

    const subjects = await Subject.find(await teacherSubjectsFilter(teacher._id))
      .populate(['departmentId', 'yearId', 'semesterId'])
      .sort({ name: 1 });
    return res.status(201).json(successResponse('Subject created and added to your teaching assignments.', { subject, subjects }));
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
