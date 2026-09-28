import mongoose from 'mongoose';
import Subject from '../models/Subject.js';
import User from '../models/User.js';
import Practical from '../models/Practical.js';
import Department from '../models/Department.js';
import Year from '../models/Year.js';
import Semester from '../models/Semester.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const subjectPopulation = [
  { path: 'departmentId' },
  { path: 'yearId' },
  { path: 'semesterId' },
  { path: 'assignedTeachers' }
];

const getStudentAcademicFilter = async (userId) => {
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

export const getAllSubjects = async (req, res, next) => {
  try {
    const filter = { status: { $ne: 'inactive' } };
    if (req.user?.role === 'student') {
      const academicFilter = await getStudentAcademicFilter(req.user.id);
      if (academicFilter) Object.assign(filter, academicFilter);
      else filter._id = { $in: [] };
    }
    if (req.user?.role === 'teacher') {
      const teacher = await User.findById(req.user.id).select('departmentId assignedSubjects');
      if (teacher?.assignedSubjects?.length) filter._id = { $in: teacher.assignedSubjects };
      else if (teacher?.departmentId) filter.departmentId = teacher.departmentId;
      else filter._id = { $in: [] };
    }

    const subjects = await Subject.find(filter).populate(subjectPopulation).sort({ name: 1 });
    return res.status(200).json(successResponse('Subjects retrieved.', { subjects }));
  } catch (error) {
    next(error);
  }
};

export const getSubjectById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json(errorResponse('Invalid subject id.', 'Bad Request', 400));
    }

    const subject = await Subject.findById(id).populate(subjectPopulation);
    if (!subject) return res.status(404).json(errorResponse('Subject not found.', 'Not Found', 404));

    if (req.user?.role === 'student') {
      const academicFilter = await getStudentAcademicFilter(req.user.id);
      if (!academicFilter || String(subject.departmentId?._id || subject.departmentId) !== String(academicFilter.departmentId) || String(subject.yearId?._id || subject.yearId) !== String(academicFilter.yearId) || String(subject.semesterId?._id || subject.semesterId) !== String(academicFilter.semesterId)) {
        return res.status(403).json(errorResponse('You are not assigned to this subject.', 'Forbidden', 403));
      }
    }

    return res.status(200).json(successResponse('Subject retrieved.', { subject }));
  } catch (error) {
    next(error);
  }
};

export const createSubject = async (req, res, next) => {
  try {
    const { name, subjectCode, code, departmentId, yearId, semesterId, description = '', status, isActive } = req.body;
    if (!name || !String(name).trim() || !departmentId || !yearId || !semesterId) {
      return res.status(400).json(errorResponse('Name, department, year and semester are required.', 'Bad Request', 400));
    }

    const payloadStatus = status === 'inactive' || status === 'disabled' || isActive === false ? 'inactive' : 'active';
    const subjectCodeValue = (subjectCode || code || name).trim().toUpperCase();
    if (![departmentId, yearId, semesterId].every((id) => mongoose.Types.ObjectId.isValid(id))) {
      return res.status(400).json(errorResponse('Department, year and semester must be valid academic record IDs.', 'Bad Request', 400));
    }
    const [department, year, semester] = await Promise.all([
      Department.findOne({ _id: departmentId, status: 'active' }),
      Year.findOne({ _id: yearId, status: 'active' }),
      Semester.findOne({ _id: semesterId, status: 'active' })
    ]);
    if (!department || !year || !semester || String(semester.yearId) !== String(year._id)) {
      return res.status(400).json(errorResponse('Select an active department, year and semester that belong together.', 'Bad Request', 400));
    }

    const subject = await Subject.create({
      name: String(name).trim(),
      subjectCode: subjectCodeValue,
      description: String(description || '').trim(),
      departmentId,
      yearId,
      semesterId,
      status: payloadStatus,
      isActive: payloadStatus === 'active'
    });

    return res.status(201).json(successResponse('Subject created.', { subject }));
  } catch (error) {
    next(error);
  }
};

export const updateSubject = async (req, res, next) => {
  try {
    const { name, subjectCode, code, description, departmentId, yearId, semesterId, status, isActive } = req.body;
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json(errorResponse('Subject not found.', 'Not Found', 404));
    const payload = {};

    if (name) payload.name = String(name).trim();
    if (subjectCode || code) payload.subjectCode = String(subjectCode || code).trim().toUpperCase();
    if (description !== undefined) payload.description = String(description).trim();
    if (status !== undefined || isActive !== undefined) {
      payload.status = status === 'inactive' || status === 'disabled' || isActive === false ? 'inactive' : 'active';
      payload.isActive = payload.status === 'active';
    }
    if (departmentId !== undefined || yearId !== undefined || semesterId !== undefined) {
      const mapping = {
        departmentId: departmentId || subject.departmentId,
        yearId: yearId || subject.yearId,
        semesterId: semesterId || subject.semesterId
      };
      if (!Object.values(mapping).every((id) => mongoose.Types.ObjectId.isValid(id))) {
        return res.status(400).json(errorResponse('Department, year and semester must be valid academic record IDs.', 'Bad Request', 400));
      }
      const [department, year, semester] = await Promise.all([
        Department.findOne({ _id: mapping.departmentId, status: 'active' }),
        Year.findOne({ _id: mapping.yearId, status: 'active' }),
        Semester.findOne({ _id: mapping.semesterId, status: 'active' })
      ]);
      if (!department || !year || !semester || String(semester.yearId) !== String(year._id)) {
        return res.status(400).json(errorResponse('Select an active department, year and semester that belong together.', 'Bad Request', 400));
      }
      Object.assign(payload, mapping);
    }

    const updatedSubject = await Subject.findByIdAndUpdate(subject._id, { $set: payload }, { new: true, runValidators: true });
    return res.status(200).json(successResponse('Subject updated.', { subject: updatedSubject }));
  } catch (error) {
    next(error);
  }
};

export const deleteSubject = async (req, res, next) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) return res.status(404).json(errorResponse('Subject not found.', 'Not Found', 404));
    return res.status(200).json(successResponse('Subject deleted.', {}));
  } catch (error) {
    next(error);
  }
};

export const getStudentSubjects = async (req, res, next) => {
  try {
    const academicFilter = await getStudentAcademicFilter(req.user.id);
    if (!academicFilter) {
      return res.status(200).json(successResponse('Student subjects fetched by department, year and semester.', { subjects: [] }));
    }

    const subjects = await Subject.find({
      ...academicFilter,
      status: { $ne: 'inactive' }
    }).populate(subjectPopulation).sort({ name: 1 });

    return res.status(200).json(successResponse('Student subjects fetched by department, year and semester.', { subjects }));
  } catch (error) {
    next(error);
  }
};

export const getSubjectPracticals = async (req, res, next) => {
  try {
    const { subjectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(subjectId)) {
      return res.status(400).json(errorResponse('Invalid subject id.', 'Bad Request', 400));
    }

    const subject = await Subject.findById(subjectId).populate(subjectPopulation);
    if (!subject) return res.status(404).json(errorResponse('Subject not found.', 'Not Found', 404));

    const filter = { subjectId: subject._id, status: 'published' };

    if (req.user?.role === 'student') {
      const academicFilter = await getStudentAcademicFilter(req.user.id);
      if (!academicFilter || String(subject.departmentId?._id || subject.departmentId) !== String(academicFilter.departmentId) || String(subject.yearId?._id || subject.yearId) !== String(academicFilter.yearId) || String(subject.semesterId?._id || subject.semesterId) !== String(academicFilter.semesterId)) {
        return res.status(403).json(errorResponse('You are not assigned to this subject.', 'Forbidden', 403));
      }
      filter.departmentId = academicFilter.departmentId;
      filter.yearId = academicFilter.yearId;
      filter.semesterId = academicFilter.semesterId;
    }

    const practicals = await Practical.find(filter).populate(['subjectId', 'departmentId', 'yearId', 'semesterId']).sort({ practicalNumber: 1 });

    return res.status(200).json(successResponse('Subject practicals retrieved.', { practicals }));
  } catch (error) {
    next(error);
  }
};
