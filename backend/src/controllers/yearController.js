import Year from '../models/Year.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const normalizeStatus = (payload = {}) => {
  const raw = payload.status ?? payload.isActive;
  if (raw === false || raw === 'inactive' || raw === 'disabled') return 'inactive';
  return 'active';
};

export const getAllYears = async (req, res, next) => {
  try {
    const requestedStatus = req.query?.status;
    const filter = requestedStatus === 'active' || requestedStatus === 'inactive'
      ? { status: requestedStatus }
      : (req.user?.role === 'admin' ? {} : { status: 'active', academicLevel: { $in: [1, 2, 3, 4] } });
    const years = await Year.find(filter).sort({ order: 1, name: 1 });
    return res.status(200).json(successResponse('Years retrieved.', { years }));
  } catch (error) {
    next(error);
  }
};

export const createYear = async (req, res, next) => {
  try {
    const { name, code, order = 1, status, isActive } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json(errorResponse('Year name is required.', 'Bad Request', 400));
    }

    const payloadStatus = normalizeStatus({ status, isActive });
    const year = await Year.create({
      name: name.trim(),
      code: (code || name).trim().toUpperCase(),
      order: Number(order || 1),
      status: payloadStatus,
      isActive: payloadStatus === 'active'
    });
    return res.status(201).json(successResponse('Year created.', { year }));
  } catch (error) {
    next(error);
  }
};

export const updateYear = async (req, res, next) => {
  try {
    const { name, code, order, status, isActive } = req.body;
    const payload = { ...req.body };

    if (name) payload.name = String(name).trim();
    if (code) payload.code = String(code).trim().toUpperCase();
    if (order !== undefined) payload.order = Number(order);
    if (status !== undefined || isActive !== undefined) {
      payload.status = normalizeStatus({ status, isActive });
      payload.isActive = payload.status === 'active';
    }

    const year = await Year.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!year) return res.status(404).json(errorResponse('Year not found.', 'Not Found', 404));
    return res.status(200).json(successResponse('Year updated.', { year }));
  } catch (error) {
    next(error);
  }
};

export const deleteYear = async (req, res, next) => {
  try {
    const year = await Year.findByIdAndDelete(req.params.id);
    if (!year) return res.status(404).json(errorResponse('Year not found.', 'Not Found', 404));
    return res.status(200).json(successResponse('Year deleted.', {}));
  } catch (error) {
    next(error);
  }
};
