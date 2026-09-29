import mongoose from 'mongoose';
import Evaluation from '../models/Evaluation.js';
import Submission from '../models/Submission.js';
import Practical from '../models/Practical.js';
import User from '../models/User.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const validId = (value) => mongoose.Types.ObjectId.isValid(value);
const sameId = (left, right) => String(left?._id || left) === String(right?._id || right);
const evaluationPopulation = ['studentId', 'teacherId', 'practicalId', 'subjectId', 'departmentId', 'yearId', 'semesterId', 'submissionId'];

async function accountFor(req) {
  return User.findById(req.user.id).select('role status departmentId assignedSubjects');
}

function canAccessPractical(account, practical) {
  if (account?.role === 'admin') return true;
  return account?.role === 'teacher' && (
    sameId(account.departmentId, practical.departmentId) ||
    sameId(practical.createdBy, account._id) ||
    (account.assignedSubjects || []).some((id) => sameId(id, practical.subjectId))
  );
}

async function teacherPracticalIds(account) {
  const practicals = await Practical.find({ $or: [{ createdBy: account._id }, { departmentId: account.departmentId }, { subjectId: { $in: account.assignedSubjects || [] } }] }).select('_id');
  return practicals.map((item) => item._id);
}

function evaluationValues(body) {
  const maximumMarks = Number(body.maximumMarks);
  const passingMarks = Number(body.passingMarks);
  const marksObtained = Number(body.marksObtained);
  if (![maximumMarks, passingMarks, marksObtained].every(Number.isFinite) || maximumMarks <= 0 || passingMarks < 0 || passingMarks > maximumMarks || marksObtained < 0 || marksObtained > maximumMarks) return null;
  const percentage = Number(((marksObtained / maximumMarks) * 100).toFixed(2));
  return { maximumMarks, passingMarks, marksObtained, percentage, resultStatus: marksObtained >= passingMarks ? 'PASS' : 'FAIL' };
}

export const saveEvaluation = async (req, res, next) => {
  try {
    const account = await accountFor(req);
    if (!account || account.status !== 'active' || !['teacher', 'admin'].includes(account.role)) return res.status(403).json(errorResponse('Only active teachers and admins can evaluate submissions.', 'Forbidden', 403));
    if (!validId(req.body.submissionId)) return res.status(400).json(errorResponse('A valid submissionId is required.', 'Bad Request', 400));
    const submission = await Submission.findById(req.body.submissionId);
    if (!submission) return res.status(404).json(errorResponse('Submission not found.', 'Not Found', 404));
    const practical = await Practical.findById(submission.practicalId);
    if (!practical || !canAccessPractical(account, practical)) return res.status(403).json(errorResponse('You are not allowed to evaluate this submission.', 'Forbidden', 403));
    const values = evaluationValues(req.body);
    if (!values) return res.status(400).json(errorResponse('Marks must be between 0 and maximum marks, and passing marks must be within that range.', 'Bad Request', 400));

    const evaluation = await Evaluation.findOneAndUpdate(
      { submissionId: submission._id },
      {
        ...values,
        submissionId: submission._id,
        studentId: submission.studentId,
        teacherId: account._id,
        practicalId: submission.practicalId,
        subjectId: submission.subjectId,
        departmentId: submission.departmentId,
        yearId: submission.yearId,
        semesterId: submission.semesterId,
        remarks: String(req.body.remarks || '').trim(),
        marksBreakdown: req.body.marksBreakdown || null,
        evaluatedAt: new Date()
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    submission.status = req.body.requestResubmission === true ? 'Resubmission Required' : 'Evaluated';
    submission.remarks = String(req.body.remarks || '').trim();
    await submission.save();
    const result = await Evaluation.findById(evaluation._id).populate(evaluationPopulation);
    return res.status(200).json(successResponse('Evaluation saved successfully.', { evaluation: result }));
  } catch (error) { next(error); }
};

export const getEvaluations = async (req, res, next) => {
  try {
    const account = await accountFor(req);
    if (!account || account.status !== 'active') return res.status(403).json(errorResponse('Account is unavailable.', 'Forbidden', 403));
    const filter = {};
    if (account.role === 'student') filter.studentId = account._id;
    else if (account.role === 'teacher') filter.practicalId = { $in: await teacherPracticalIds(account) };
    else if (account.role !== 'admin') return res.status(403).json(errorResponse('You are not allowed to view evaluations.', 'Forbidden', 403));
    if (req.query.status) filter.resultStatus = req.query.status;
    const evaluations = await Evaluation.find(filter).populate(evaluationPopulation).sort({ updatedAt: -1 });
    return res.status(200).json(successResponse('Evaluations retrieved.', { evaluations }));
  } catch (error) { next(error); }
};

export const getStudentEvaluations = async (req, res, next) => {
  try {
    const account = await accountFor(req);
    const requestedStudentId = req.params.studentId || account?._id;
    if (!validId(requestedStudentId)) return res.status(400).json(errorResponse('Invalid student id.', 'Bad Request', 400));
    if (account?.role === 'student' && !sameId(account._id, requestedStudentId)) return res.status(403).json(errorResponse('You can only view your own results.', 'Forbidden', 403));
    if (!['student', 'teacher', 'admin'].includes(account?.role)) return res.status(403).json(errorResponse('You are not allowed to view evaluations.', 'Forbidden', 403));
    if (account.role === 'teacher') {
      const ids = await teacherPracticalIds(account);
      const evaluations = await Evaluation.find({ studentId: requestedStudentId, practicalId: { $in: ids } }).populate(evaluationPopulation).sort({ updatedAt: -1 });
      return res.status(200).json(successResponse('Student evaluations retrieved.', { evaluations }));
    }
    const evaluations = await Evaluation.find({ studentId: requestedStudentId }).populate(evaluationPopulation).sort({ updatedAt: -1 });
    return res.status(200).json(successResponse('Student evaluations retrieved.', { evaluations }));
  } catch (error) { next(error); }
};

export const getPracticalEvaluations = async (req, res, next) => {
  try {
    if (!validId(req.params.practicalId)) return res.status(400).json(errorResponse('Invalid practical id.', 'Bad Request', 400));
    const account = await accountFor(req);
    const practical = await Practical.findById(req.params.practicalId);
    if (!practical || !canAccessPractical(account, practical)) return res.status(403).json(errorResponse('You are not allowed to view these evaluations.', 'Forbidden', 403));
    const evaluations = await Evaluation.find({ practicalId: practical._id }).populate(evaluationPopulation).sort({ updatedAt: -1 });
    return res.status(200).json(successResponse('Practical evaluations retrieved.', { evaluations }));
  } catch (error) { next(error); }
};
