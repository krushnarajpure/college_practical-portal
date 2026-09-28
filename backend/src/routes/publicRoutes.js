import express from 'express';
import Department from '../models/Department.js';
import Year from '../models/Year.js';
import Semester from '../models/Semester.js';
import { successResponse } from '../utils/apiResponse.js';

const router = express.Router();

router.get('/departments', async (_req, res, next) => {
  try {
    const departments = await Department.find({ status: 'active' }).sort({ name: 1 });
    return res.status(200).json(successResponse('Active departments retrieved.', { departments }));
  } catch (error) {
    next(error);
  }
});

router.get('/years', async (_req, res, next) => {
  try {
    const years = await Year.find({ status: 'active', academicLevel: { $in: [1, 2, 3, 4] } }).sort({ academicLevel: 1 });
    return res.status(200).json(successResponse('Active years retrieved.', { years }));
  } catch (error) {
    next(error);
  }
});

router.get('/semesters', async (_req, res, next) => {
  try {
    const semesters = await Semester.find({ status: 'active' }).populate('yearId').sort({ number: 1, name: 1 });
    return res.status(200).json(successResponse('Active semesters retrieved.', { semesters }));
  } catch (error) {
    next(error);
  }
});

export default router;