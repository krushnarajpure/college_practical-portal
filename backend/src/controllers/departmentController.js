import Department from '../models/Department.js';
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
    const departments = await Department.find(filter).sort({ name: 1 });
    return res.status(200).json(successResponse('Departments retrieved.', { departments }));
  } catch (error) {
    next(error);
  }
};

export const createDepartment = async (req, res, next) => {
  try {
    const { name, code, description = '', status, isActive } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json(errorResponse('Department name is required.', 'Bad Request', 400));
    }

    const payloadStatus = normalizeStatus({ status, isActive });
    const department = await Department.create({
      name: name.trim(),
      code: (code || name).trim().toUpperCase(),
      description: String(description || '').trim(),
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
    const { name, code, description, status, isActive } = req.body;
    const payload = { ...req.body };

    if (name) payload.name = String(name).trim();
    if (code) payload.code = String(code).trim().toUpperCase();
    if (description !== undefined) payload.description = String(description).trim();
    if (status !== undefined || isActive !== undefined) {
      payload.status = normalizeStatus({ status, isActive });
      payload.isActive = payload.status === 'active';
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
    const department = await Department.findByIdAndDelete(req.params.id);
    if (!department) return res.status(404).json(errorResponse('Department not found.', 'Not Found', 404));
    return res.status(200).json(successResponse('Department deleted.', {}));
  } catch (error) {
    next(error);
  }
};
