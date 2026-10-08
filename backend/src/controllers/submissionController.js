import mongoose from 'mongoose';
import Submission from '../models/Submission.js';
import Practical from '../models/Practical.js';
import User from '../models/User.js';
import { getGridFSBucket } from '../config/storage.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const validId = (value) => mongoose.Types.ObjectId.isValid(value);
const sameId = (left, right) => String(left?._id || left) === String(right?._id || right);
const submissionPopulation = ['studentId', 'practicalId', 'subjectId', 'departmentId', 'yearId', 'semesterId'];

async function accountFor(req) {
  return User.findById(req.user.id).select('role status departmentId yearId semesterId assignedSubjects');
}

function studentCanAccess(account, practical) {
  return account?.role === 'student' && practical.status === 'published' &&
    sameId(account.departmentId, practical.departmentId) &&
    sameId(account.yearId, practical.yearId) && sameId(account.semesterId, practical.semesterId);
}

function teacherCanAccess(account, practical) {
  if (account?.role === 'admin') return true;
  if (account?.role !== 'teacher') return false;
  return sameId(account.departmentId, practical.departmentId) || sameId(practical.createdBy, account._id) ||
    (account.assignedSubjects || []).some((subjectId) => sameId(subjectId, practical.subjectId));
}

async function getAuthorizedSubmission(req, id) {
  if (!validId(id)) return null;
  const submission = await Submission.findById(id).populate(submissionPopulation);
  if (!submission) return null;
  const account = await accountFor(req);
  const allowed = account?.role === 'admin' ||
    (account?.role === 'student' && sameId(submission.studentId, account._id)) ||
    (account?.role === 'teacher' && teacherCanAccess(account, submission.practicalId));
  return allowed ? submission : false;
}

export const createSubmission = async (req, res, next) => {
  try {
    const account = await accountFor(req);
    if (!account || account.status !== 'active' || account.role !== 'student') return res.status(403).json(errorResponse('Only active students can submit practical work.', 'Forbidden', 403));
    if (!validId(req.body.practicalId)) return res.status(400).json(errorResponse('A valid practicalId is required.', 'Bad Request', 400));
    const practical = await Practical.findById(req.body.practicalId);
    if (!practical || !studentCanAccess(account, practical)) return res.status(404).json(errorResponse('Practical not found or not available for your academic mapping.', 'Not Found', 404));
    if (!req.file && !String(req.body.content || '').trim()) return res.status(400).json(errorResponse('Upload a PDF or provide submission content.', 'Bad Request', 400));

    const latest = await Submission.findOne({ studentId: account._id, practicalId: practical._id }).sort({ attempt: -1 });
    if (latest && latest.status !== 'Resubmission Required') {
      if (req.file?.gridFsFileId) {
        try {
          await getGridFSBucket().delete(req.file.gridFsFileId);
        } catch (cleanupError) {
          return next(cleanupError);
        }
      }
      return res.status(409).json(errorResponse('A new attempt is allowed only after your teacher requests a resubmission.', 'Conflict', 409));
    }
    const file = req.file ? {
      gridFsFileId: req.file.gridFsFileId,
      originalFileName: req.file.originalFileName,
      mimeType: req.file.mimeType,
      fileSize: req.file.size || 0
    } : undefined;
    const submission = await Submission.create({
      studentId: account._id,
      practicalId: practical._id,
      subjectId: practical.subjectId,
      departmentId: practical.departmentId,
      yearId: practical.yearId,
      semesterId: practical.semesterId,
      attempt: (latest?.attempt || 0) + 1,
      submissionFile: file,
      content: String(req.body.content || '').trim(),
      status: 'Submitted'
    });
    const result = await Submission.findById(submission._id).populate(submissionPopulation);
    return res.status(201).json(successResponse('Practical submitted successfully.', { submission: result }));
  } catch (error) {
    if (req.file?.gridFsFileId) {
      try { await getGridFSBucket().delete(req.file.gridFsFileId); } catch { /* cleanup is best effort */ }
    }
    next(error);
  }
};

export const getStudentSubmissions = async (req, res, next) => {
  try {
    const submissions = await Submission.find({ studentId: req.user.id }).populate(submissionPopulation).sort({ updatedAt: -1 });
    return res.status(200).json(successResponse('Student submissions retrieved.', { submissions }));
  } catch (error) { next(error); }
};

export const getSubmissions = async (req, res, next) => {
  try {
    const account = await accountFor(req);
    if (!account || !['teacher', 'admin'].includes(account.role)) return res.status(403).json(errorResponse('Only teachers and admins can view submissions.', 'Forbidden', 403));
    let filter = {};
    if (account.role === 'teacher') {
      const practicals = await Practical.find({ $or: [{ createdBy: account._id }, { departmentId: account.departmentId }, { subjectId: { $in: account.assignedSubjects || [] } }] }).select('_id');
      filter.practicalId = { $in: practicals.map((item) => item._id) };
    }
    if (req.query.status) filter.status = req.query.status;
    const submissions = await Submission.find(filter).populate(submissionPopulation).sort({ updatedAt: -1 });
    return res.status(200).json(successResponse('Submissions retrieved.', { submissions }));
  } catch (error) { next(error); }
};

export const getPracticalSubmissions = async (req, res, next) => {
  try {
    if (!validId(req.params.practicalId)) return res.status(400).json(errorResponse('Invalid practical id.', 'Bad Request', 400));
    const account = await accountFor(req);
    const practical = await Practical.findById(req.params.practicalId);
    if (!practical || !teacherCanAccess(account, practical)) return res.status(403).json(errorResponse('You are not allowed to view these submissions.', 'Forbidden', 403));
    const submissions = await Submission.find({ practicalId: practical._id }).populate(submissionPopulation).sort({ updatedAt: -1 });
    return res.status(200).json(successResponse('Practical submissions retrieved.', { submissions }));
  } catch (error) { next(error); }
};

export const getSubmissionFile = async (req, res, next) => {
  try {
    const submission = await getAuthorizedSubmission(req, req.params.id);
    if (submission === false) return res.status(403).json(errorResponse('You are not allowed to access this submission.', 'Forbidden', 403));
    if (!submission) return res.status(404).json(errorResponse('Submission not found.', 'Not Found', 404));
    const file = submission.submissionFile;
    if (!file?.gridFsFileId) return res.status(404).json(errorResponse('No submission file is attached.', 'Not Found', 404));
    res.setHeader('Content-Type', file.mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${file.originalFileName || 'submission.pdf'}"`);
    return getGridFSBucket().openDownloadStream(file.gridFsFileId).on('error', next).pipe(res);
  } catch (error) { next(error); }
};
