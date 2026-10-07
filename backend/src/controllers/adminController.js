import mongoose from 'mongoose';
import { successResponse } from '../utils/apiResponse.js';
import Department from '../models/Department.js';
import Year from '../models/Year.js';
import Semester from '../models/Semester.js';
import Subject from '../models/Subject.js';
import User from '../models/User.js';
import Practical from '../models/Practical.js';
import { env } from '../config/env.js';
import { getProfilePhotoBucket, storageConfig } from '../config/storage.js';
import { errorResponse } from '../utils/apiResponse.js';

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

export const getAdminStudentPhoto = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.studentId)) {
      return res.status(400).json(errorResponse('Invalid student id.', 'Bad Request', 400));
    }

    const student = await User.findOne({ _id: req.params.studentId, role: 'student' }).select('profilePhotoId');
    if (!student?.profilePhotoId) {
      return res.status(404).json(errorResponse('No profile photo is available.', 'Not Found', 404));
    }

    const bucket = getProfilePhotoBucket();
    const file = await bucket.find({ _id: student.profilePhotoId }).next();
    if (!file) return res.status(404).json(errorResponse('No profile photo is available.', 'Not Found', 404));

    res.setHeader('Content-Type', file.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=300');
    const downloadStream = bucket.openDownloadStream(student.profilePhotoId);
    downloadStream.on('error', (error) => {
      if (!res.headersSent) next(error);
      else res.destroy(error);
    });
    downloadStream.pipe(res);
  } catch (error) {
    next(error);
  }
};

export const getAdminStorage = async (_req, res, next) => {
  try {
    const db = mongoose.connection.db;
    if (!db) throw Object.assign(new Error('MongoDB is not connected.'), { name: 'MongoNotConnectedError', statusCode: 503 });

    const [databaseStats, profilePhotoStats, practicalPdfStats, academicDocumentStats, academicNoteStats] = await Promise.all([
      db.stats(),
      db.collection('profilePhotos.files').aggregate([{ $group: { _id: null, bytes: { $sum: '$length' }, files: { $sum: 1 } } }]).next(),
      db.collection('practicalPDFs.files').aggregate([{ $group: { _id: null, bytes: { $sum: '$length' }, files: { $sum: 1 } } }]).next(),
      db.collection('academicDocuments.files').aggregate([{ $group: { _id: null, bytes: { $sum: '$length' }, files: { $sum: 1 } } }]).next(),
      db.collection('academicNotes.files').aggregate([{ $group: { _id: null, bytes: { $sum: '$length' }, files: { $sum: 1 } } }]).next()
    ]);
    const limitBytes = env.mongoStorageLimitMb ? env.mongoStorageLimitMb * 1024 * 1024 : null;
    const usedBytes = Number(databaseStats.storageSize || 0) + Number(databaseStats.indexSize || 0);

    return res.status(200).json(successResponse('MongoDB storage usage retrieved.', {
      databaseName: db.databaseName,
      uploadLimitBytes: storageConfig.maxFileSize,
      collections: Number(databaseStats.collections || 0),
      documents: Number(databaseStats.objects || 0),
      dataBytes: Number(databaseStats.dataSize || 0),
      usedBytes,
      limitBytes,
      remainingBytes: limitBytes === null ? null : Math.max(0, limitBytes - usedBytes),
      usagePercent: limitBytes ? Math.round((usedBytes / limitBytes) * 10000) / 100 : null,
      quotaSource: env.mongoStorageLimitSource,
      storageEngine: 'MongoDB',
      binaryStorage: 'GridFS',
      gridFs: {
        profilePhotos: { files: profilePhotoStats?.files || 0, bytes: profilePhotoStats?.bytes || 0 },
        practicalPdfs: { files: practicalPdfStats?.files || 0, bytes: practicalPdfStats?.bytes || 0 },
        academicDocuments: { files: academicDocumentStats?.files || 0, bytes: academicDocumentStats?.bytes || 0 },
        academicNotes: { files: academicNoteStats?.files || 0, bytes: academicNoteStats?.bytes || 0 },
        totalFiles: [profilePhotoStats, practicalPdfStats, academicDocumentStats, academicNoteStats].reduce((total, bucket) => total + Number(bucket?.files || 0), 0),
        totalBytes: [profilePhotoStats, practicalPdfStats, academicDocumentStats, academicNoteStats].reduce((total, bucket) => total + Number(bucket?.bytes || 0), 0)
      }
    }));
  } catch (error) {
    next(error);
  }
};

export const getSubjects = async (req, res) => {
  const subjects = await Subject.find().populate(['departmentId', 'yearId', 'semesterId']).sort({ name: 1 });
  return res.status(200).json(successResponse('Subjects retrieved.', { subjects }));
};

export const getPracticals = async (req, res) => {
  const practicals = await Practical.find().populate(['subjectId', 'departmentId', 'yearId', 'semesterId']).sort({ updatedAt: -1 });
  return res.status(200).json(successResponse('Practicals retrieved.', { practicals }));
};
