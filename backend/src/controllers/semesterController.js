import Semester from '../models/Semester.js';
import Year from '../models/Year.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const normalizeStatus = (payload = {}) => {
  const raw = payload.status ?? payload.isActive;
  if (raw === false || raw === 'inactive' || raw === 'disabled') return 'inactive';
  return 'active';
};

export const getAllSemesters = async (req, res, next) => {
  try {
    const requestedStatus = req.query?.status;
    const filter = requestedStatus === 'active' || requestedStatus === 'inactive'
      ? { status: requestedStatus }
      : (req.user?.role === 'admin' ? {} : { status: 'active' });
    const semesters = await Semester.find(filter).populate('yearId').sort({ number: 1, name: 1 });
    return res.status(200).json(successResponse('Semesters retrieved.', { semesters }));
  } catch (error) {
    next(error);
  }
};

export const createSemester = async (req, res, next) => {
  try {
    const { name, code, number = 1, yearId, status, isActive } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json(errorResponse('Semester name is required.', 'Bad Request', 400));
    }
    if (!yearId) {
      return res.status(400).json(errorResponse('Year is required for a semester.', 'Bad Request', 400));
    }

    const year = await Year.findById(yearId);
    if (!year) {
      return res.status(404).json(errorResponse('Selected year was not found.', 'Not Found', 404));
    }

    const payloadStatus = normalizeStatus({ status, isActive });
    const semester = await Semester.create({
      name: name.trim(),
      code: (code || `SEM-${number}`).trim().toUpperCase(),
      number: Number(number || 1),
      yearId,
      status: payloadStatus,
      isActive: payloadStatus === 'active'
    });
    return res.status(201).json(successResponse('Semester created.', { semester }));
  } catch (error) {
    next(error);
  }
};

export const updateSemester = async (req, res, next) => {
  try {
    const { name, code, number, yearId, status, isActive } = req.body;
    const payload = { ...req.body };

    if (name) payload.name = String(name).trim();
    if (code) payload.code = String(code).trim().toUpperCase();
    if (number !== undefined) payload.number = Number(number);
    if (yearId) {
      const year = await Year.findById(yearId);
      if (!year) return res.status(404).json(errorResponse('Selected year was not found.', 'Not Found', 404));
      payload.yearId = yearId;
    }
    if (status !== undefined || isActive !== undefined) {
      payload.status = normalizeStatus({ status, isActive });
      payload.isActive = payload.status === 'active';
    }

    const semester = await Semester.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!semester) return res.status(404).json(errorResponse('Semester not found.', 'Not Found', 404));
    return res.status(200).json(successResponse('Semester updated.', { semester }));
  } catch (error) {
    next(error);
  }
};

export const deleteSemester = async (req, res, next) => {
  try {
    const semester = await Semester.findByIdAndDelete(req.params.id);
    if (!semester) return res.status(404).json(errorResponse('Semester not found.', 'Not Found', 404));
    return res.status(200).json(successResponse('Semester deleted.', {}));
  } catch (error) {
    next(error);
  }
};
