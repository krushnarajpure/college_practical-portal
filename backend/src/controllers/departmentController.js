
import Department from '../models/Department.js';
import User from '../models/User.js';
import Subject from '../models/Subject.js';
import Practical from '../models/Practical.js';
import AcademicDocument from '../models/AcademicDocument.js';
import Program from '../models/Program.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const normalizeStatus = (payload = {}) => {
  const raw = payload.status ?? payload.isActive;
  if (raw === false || raw === 'inactive' || raw === 'disabled') return 'inactive';
  return 'active';
};

export const getAllDepartments = async (req, res, next) => {
  try {
    const requestedStatus = req.query?.status;
    const filter = requestedStatus === 'active' || requestedStatus === 'inactive'
      ? { status: requestedStatus }
      : (req.user?.role === 'admin' ? {} : { status: 'active' });
    const [items, enrollments, subjects] = await Promise.all([
      Department.find(filter).populate('programId').sort({ name: 1 }).lean(),
      User.aggregate([{ $match: { role: 'student' } }, { $group: { _id: '$departmentId', count: { $sum: 1 } } }]),
      Subject.aggregate([{ $group: { _id: '$departmentId', count: { $sum: 1 } } }])
    ]);
    const enrollmentCounts = new Map(enrollments.map(({ _id, count }) => [String(_id), count]));
    const subjectCounts = new Map(subjects.map(({ _id, count }) => [String(_id), count]));
    const departments = items.map((department) => ({
      ...department,
      enrollmentCount: enrollmentCounts.get(String(department._id)) || 0,
      subjectCount: subjectCounts.get(String(department._id)) || 0
    }));
    return res.status(200).json(successResponse('Departments retrieved.', { departments }));
  } catch (error) {
    next(error);
  }
};

export const createDepartment = async (req, res, next) => {
  try {
    const { name, code, description = '', programId, status, isActive } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json(errorResponse('Department name is required.', 'Bad Request', 400));
    }

    const payloadStatus = normalizeStatus({ status, isActive });
    if (programId && (!mongoose.Types.ObjectId.isValid(programId) || !(await Program.exists({ _id: programId })))) {
      return res.status(400).json(errorResponse('Select a valid course.', 'Bad Request', 400));
    }
    if (req.body.verificationStatus === 'prospectus-verified' && !String(req.body.officialSourceUrl || '').trim()) {
      return res.status(400).json(errorResponse('Prospectus verification requires an official source URL.', 'Bad Request', 400));
    }
    const department = await Department.create({
      name: name.trim(),
      branchName: String(req.body.branchName || name).trim(),
      code: (code || name).trim().toUpperCase(),
      description: String(description || '').trim(),
      programId: programId || null,
      verificationStatus: req.body.verificationStatus === 'prospectus-verified' ? 'prospectus-verified' : 'pending-prospectus',
      officialSourceUrl: String(req.body.officialSourceUrl || '').trim(),
      officialSourceTitle: String(req.body.officialSourceTitle || '').trim(),
      status: payloadStatus,
      isActive: payloadStatus === 'active'
    });
    return res.status(201).json(successResponse('Department created.', { department }));
  } catch (error) {
    next(error);
  }
};

export const updateDepartment = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse('Invalid department id.', 'Bad Request', 400));
    }
    const { name, branchName, code, description, status, isActive } = req.body;
    const payload = { ...req.body };

    if (name) payload.name = String(name).trim();
    if (branchName !== undefined) payload.branchName = String(branchName).trim();
    if (code) payload.code = String(code).trim().toUpperCase();
    if (description !== undefined) payload.description = String(description).trim();
    if (payload.verificationStatus !== undefined) {
      payload.verificationStatus = payload.verificationStatus === 'prospectus-verified' ? 'prospectus-verified' : 'pending-prospectus';
    }
    if (payload.officialSourceUrl !== undefined) payload.officialSourceUrl = String(payload.officialSourceUrl).trim();
    if (payload.officialSourceTitle !== undefined) payload.officialSourceTitle = String(payload.officialSourceTitle).trim();
    if (status !== undefined || isActive !== undefined) {
      payload.status = normalizeStatus({ status, isActive });
      payload.isActive = payload.status === 'active';
    }

    if (payload.programId && (!mongoose.Types.ObjectId.isValid(payload.programId) || !(await Program.exists({ _id: payload.programId })))) {
      return res.status(400).json(errorResponse('Select a valid course.', 'Bad Request', 400));
    }
    const existing = await Department.findById(req.params.id);
    if (!existing) return res.status(404).json(errorResponse('Department not found.', 'Not Found', 404));
    const effectiveSourceUrl = payload.officialSourceUrl !== undefined ? payload.officialSourceUrl : existing.officialSourceUrl;
    if (payload.verificationStatus === 'prospectus-verified' && !effectiveSourceUrl) {
      return res.status(400).json(errorResponse('Prospectus verification requires an official source URL.', 'Bad Request', 400));
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'programId') && String(payload.programId || '') !== String(existing.programId || '')) {
      const [students, subjects, practicals, documents] = await Promise.all([
        User.exists({ departmentId: existing._id }),
        Subject.exists({ departmentId: existing._id }),
        Practical.exists({ departmentId: existing._id }),
        AcademicDocument.exists({ departmentId: existing._id })
      ]);
      if (students || subjects || practicals || documents) {
        return res.status(409).json(errorResponse('This branch has linked users or academic records and cannot be moved to another course.', 'Conflict', 409));
      }
    }
    const department = await Department.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!department) return res.status(404).json(errorResponse('Department not found.', 'Not Found', 404));
    return res.status(200).json(successResponse('Department updated.', { department }));
  } catch (error) {
    next(error);
  }
};

export const deleteDepartment = async (req, res, next) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) return res.status(404).json(errorResponse('Department not found.', 'Not Found', 404));
    const [students, subjects, practicals, documents] = await Promise.all([
      User.exists({ departmentId: department._id }),
      Subject.exists({ departmentId: department._id }),
      Practical.exists({ departmentId: department._id }),
      AcademicDocument.exists({ departmentId: department._id })
    ]);
    if (students || subjects || practicals || documents) {
      return res.status(409).json(errorResponse('This branch has student or academic records. Deactivate it instead of deleting it.', 'Conflict', 409));
    }
    await department.deleteOne();
    return res.status(200).json(successResponse('Department deleted.', {}));
  } catch (error) {
    next(error);
  }
};
