import mongoose from 'mongoose';
import Practical from '../models/Practical.js';
import Subject from '../models/Subject.js';
import User from '../models/User.js';
import { getGridFSBucket } from '../config/storage.js';
import pdfService from '../services/pdfService.js';
import aiService from '../services/aiService.js';
import notificationService from '../services/notificationService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const populatedPractical = (query) => query.populate(['subjectId', 'departmentId', 'yearId', 'semesterId']);
const academicFields = ['departmentId', 'yearId', 'semesterId'];
const guideFields = ['aim', 'about', 'objectives', 'requirements', 'theory', 'procedure', 'task', 'expectedOutput', 'importantPoints', 'commonErrors', 'vivaQuestions'];

function validId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

function sameId(left, right) {
  return String(left?._id || left) === String(right?._id || right);
}

function normalizeList(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : String(value || '').split('\n').map((item) => item.trim()).filter(Boolean);
}

async function getAccount(req) {
  if (!validId(req.user?.id)) return null;
  return User.findById(req.user.id).select('name role status departmentId yearId semesterId assignedSubjects');
}

async function getMappedSubject({ subjectId, departmentId, yearId, semesterId }) {
  if (![subjectId, departmentId, yearId, semesterId].every(validId)) return null;
  return Subject.findOne({
    _id: subjectId,
    departmentId,
    yearId,
    semesterId,
    status: { $ne: 'inactive' }
  });
}

async function canManage(account, practical) {
  if (account?.status !== 'active') return false;
  if (account?.role === 'admin') return true;
  return account?.role === 'teacher' && sameId(practical.createdBy, account._id);
}

function canTeachSubject(account, subject, departmentId) {
  if (account?.role !== 'teacher') return true;
  if (account.assignedSubjects?.some((id) => sameId(id, subject._id))) return true;
  return Boolean(account.departmentId && sameId(account.departmentId, departmentId));
}

function deny(res) {
  return res.status(403).json(errorResponse('You are not allowed to manage this practical.', 'Forbidden', 403));
}

async function recordTeacherPracticalActivity(account, practical, action, verb) {
  if (account.role !== 'teacher') return;
  const subjectName = practical.subjectId?.name || (await Subject.findById(practical.subjectId).select('name'))?.name || 'a subject';
  await notificationService.createAdminActivity({
    actorId: account._id,
    action,
    entityType: 'practical',
    entityId: practical._id,
    practicalId: practical._id,
    message: `${account.name} ${verb} "${practical.title}" (${subjectName}, Practical ${practical.practicalNumber}).`
  });
}

export const getAllPracticals = async (req, res, next) => {
  try {
    const account = await getAccount(req);
    if (!account || account.status !== 'active') return res.status(403).json(errorResponse('Account is unavailable.', 'Forbidden', 403));

    let filter = {};
    if (account.role === 'student') {
      if (!account.departmentId || !account.yearId || !account.semesterId) {
        return res.status(200).json(successResponse('Practicals retrieved.', { practicals: [] }));
      }
      filter = { departmentId: account.departmentId, yearId: account.yearId, semesterId: account.semesterId, status: 'published' };
    } else if (account.role === 'teacher') {
      filter = { createdBy: account._id };
    }

    const practicals = await populatedPractical(Practical.find(filter).sort({ practicalNumber: 1 }));
    return res.status(200).json(successResponse('Practicals retrieved.', { practicals }));
  } catch (error) {
    next(error);
  }
};

export const getTeacherPracticals = async (req, res, next) => {
  try {
    const account = await getAccount(req);
    if (!account || account.status !== 'active') return res.status(403).json(errorResponse('Account is unavailable.', 'Forbidden', 403));
    const practicals = await populatedPractical(Practical.find({ createdBy: req.user.id }).sort({ updatedAt: -1 }));
    return res.status(200).json(successResponse('Teacher practicals retrieved.', { practicals }));
  } catch (error) {
    next(error);
  }
};

export const getPracticalById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!validId(id)) return res.status(400).json(errorResponse('Invalid practical id.', 'Bad Request', 400));
    const account = await getAccount(req);
    if (!account || account.status !== 'active') return res.status(403).json(errorResponse('Account is unavailable.', 'Forbidden', 403));

    const practical = await populatedPractical(Practical.findById(id));
    if (!practical) return res.status(404).json(errorResponse('Practical not found.', 'Not Found', 404));

    if (account.role === 'student') {
      const matches = practical.status === 'published' && account.departmentId && account.yearId && account.semesterId &&
        sameId(practical.departmentId, account.departmentId) && sameId(practical.yearId, account.yearId) && sameId(practical.semesterId, account.semesterId);
      if (!matches) return res.status(404).json(errorResponse('Practical not found or not available for your academic mapping.', 'Not Found', 404));
    } else if (!(await canManage(account, practical))) {
      return deny(res);
    }

    return res.status(200).json(successResponse('Practical retrieved.', { practical }));
  } catch (error) {
    next(error);
  }
};

export const createPractical = async (req, res, next) => {
  try {
    const account = await getAccount(req);
    if (!account || account.status !== 'active' || !['teacher', 'admin'].includes(account.role)) {
      return res.status(403).json(errorResponse('Only active teachers and admins can create practicals.', 'Forbidden', 403));
    }

    const { subjectId, departmentId, yearId, semesterId, practicalNumber, title } = req.body;
    const subject = await getMappedSubject({ subjectId, departmentId, yearId, semesterId });
    if (!subject) return res.status(400).json(errorResponse('Choose a subject that matches the selected department, year and semester.', 'Bad Request', 400));
    if (!canTeachSubject(account, subject, departmentId)) return deny(res);
    if (!Number.isInteger(Number(practicalNumber)) || Number(practicalNumber) < 1 || !String(title || '').trim()) {
      return res.status(400).json(errorResponse('A positive practical number and title are required.', 'Bad Request', 400));
    }

    const practical = await Practical.create({
      subjectId: subject._id,
      departmentId: subject.departmentId,
      yearId: subject.yearId,
      semesterId: subject.semesterId,
      practicalNumber: Number(practicalNumber),
      title: String(title).trim(),
      status: 'draft',
      createdBy: account._id,
      updatedBy: account._id
    });
    const result = await populatedPractical(Practical.findById(practical._id));
    await recordTeacherPracticalActivity(account, practical, 'practical_created', 'created');
    return res.status(201).json(successResponse('Practical created.', { practical: result }));
  } catch (error) {
    next(error);
  }
};

export const updatePractical = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json(errorResponse('Invalid practical id.', 'Bad Request', 400));
    const account = await getAccount(req);
    const practical = await Practical.findById(req.params.id);
    if (!practical) return res.status(404).json(errorResponse('Practical not found.', 'Not Found', 404));
    if (!(await canManage(account, practical))) return deny(res);
    if (req.body.status !== undefined || req.body.createdBy !== undefined || req.body.updatedBy !== undefined || req.body.pdfId !== undefined) {
      return res.status(400).json(errorResponse('Use the dedicated publish and PDF endpoints for those fields.', 'Bad Request', 400));
    }

    const updates = {};
    for (const field of ['title', 'practicalNumber', ...guideFields]) {
      if (req.body[field] !== undefined) updates[field] = field === 'practicalNumber' ? Number(req.body[field]) : req.body[field];
    }
    if (updates.title !== undefined) updates.title = String(updates.title).trim();
    if (updates.practicalNumber !== undefined && (!Number.isInteger(updates.practicalNumber) || updates.practicalNumber < 1)) {
      return res.status(400).json(errorResponse('Practical number must be a positive integer.', 'Bad Request', 400));
    }
    for (const field of ['objectives', 'requirements', 'procedure', 'importantPoints', 'commonErrors', 'vivaQuestions']) {
      if (updates[field] !== undefined) updates[field] = normalizeList(updates[field]);
    }
    if (req.body.concept !== undefined && req.body.theory === undefined) updates.theory = req.body.concept;
    if (academicFields.some((field) => req.body[field] !== undefined) || req.body.subjectId !== undefined) {
      const mapping = {
        subjectId: req.body.subjectId || practical.subjectId,
        departmentId: req.body.departmentId || practical.departmentId,
        yearId: req.body.yearId || practical.yearId,
        semesterId: req.body.semesterId || practical.semesterId
      };
      const subject = await getMappedSubject(mapping);
      if (!subject) return res.status(400).json(errorResponse('Choose a subject that matches the selected department, year and semester.', 'Bad Request', 400));
      if (!canTeachSubject(account, subject, subject.departmentId)) return deny(res);
      Object.assign(updates, mapping);
    }
    updates.updatedBy = account._id;
    if (guideFields.some((field) => updates[field] !== undefined) || req.body.concept !== undefined) {
      updates.teacherApproved = true;
      updates.aiGenerated = false;
    }

    await Practical.findByIdAndUpdate(practical._id, { $set: updates }, { runValidators: true });
    const updated = await populatedPractical(Practical.findById(practical._id));
    await recordTeacherPracticalActivity(account, updated, 'practical_updated', 'updated');
    return res.status(200).json(successResponse('Practical updated.', { practical: updated }));
  } catch (error) {
    next(error);
  }
};

export const deletePractical = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json(errorResponse('Invalid practical id.', 'Bad Request', 400));
    const account = await getAccount(req);
    const practical = await Practical.findById(req.params.id);
    if (!practical) return res.status(404).json(errorResponse('Practical not found.', 'Not Found', 404));
    if (!(await canManage(account, practical))) return deny(res);
    if (practical.pdfId) await pdfService.deletePdf(practical.pdfId);
    await practical.deleteOne();
    await recordTeacherPracticalActivity(account, practical, 'practical_deleted', 'deleted');
    return res.status(200).json(successResponse('Practical deleted.', {}));
  } catch (error) {
    next(error);
  }
};

async function setPublishedState(req, res, next, status) {
  try {
    if (!validId(req.params.id)) return res.status(400).json(errorResponse('Invalid practical id.', 'Bad Request', 400));
    const account = await getAccount(req);
    const practical = await Practical.findById(req.params.id);
    if (!practical) return res.status(404).json(errorResponse('Practical not found.', 'Not Found', 404));
    if (!(await canManage(account, practical))) return deny(res);
    if (status === 'published' && !practical.pdfId) return res.status(400).json(errorResponse('Upload the original PDF before publishing this practical.', 'Bad Request', 400));
    if (status === 'published' && !practical.teacherApproved) return res.status(400).json(errorResponse('Review and save the AI practical guide before publishing.', 'Bad Request', 400));

    practical.status = status;
    practical.publishedAt = status === 'published' ? new Date() : null;
    practical.updatedBy = account._id;
    if (status === 'published') practical.teacherApproved = true;
    await practical.save();
    const result = await populatedPractical(Practical.findById(practical._id));
    await recordTeacherPracticalActivity(account, practical, status === 'published' ? 'practical_published' : 'practical_unpublished', status === 'published' ? 'published' : 'unpublished');
    return res.status(200).json(successResponse(`Practical ${status === 'published' ? 'published' : 'unpublished'}.`, { practical: result }));
  } catch (error) {
    next(error);
  }
}

export const publishPractical = (req, res, next) => setPublishedState(req, res, next, 'published');
export const unpublishPractical = (req, res, next) => setPublishedState(req, res, next, 'draft');

export const analyzePractical = async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json(errorResponse('Invalid practical id.', 'Bad Request', 400));
    const account = await getAccount(req);
    const practical = await Practical.findById(req.params.id);
    if (!practical) return res.status(404).json(errorResponse('Practical not found.', 'Not Found', 404));
    if (!(await canManage(account, practical))) return deny(res);
    if (!practical.pdfId) return res.status(400).json(errorResponse('Upload the original PDF before analyzing it.', 'Bad Request', 400));

    const pdf = await pdfService.getPdfById(practical.pdfId);
    const chunks = [];
    await new Promise((resolve, reject) => {
      const stream = getGridFSBucket().openDownloadStream(pdf.gridFsFileId);
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.once('error', reject);
      stream.once('end', resolve);
    });
    const analysis = await aiService.generateStructuredPractical({ pdfBuffer: Buffer.concat(chunks), title: practical.title });

    Object.assign(practical, analysis, {
      title: practical.title,
      aiGenerated: true,
      teacherApproved: false,
      status: 'draft',
      updatedBy: account._id
    });
    await practical.save();
    const result = await populatedPractical(Practical.findById(practical._id));
    await recordTeacherPracticalActivity(account, practical, 'practical_analyzed', 'uploaded and analyzed a PDF for');
    return res.status(200).json(successResponse('PDF analysis saved for teacher review.', { practical: result }));
  } catch (error) {
    next(error);
  }
};
