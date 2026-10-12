import mongoose from 'mongoose';
import express from 'express';
import Department from '../models/Department.js';
import Program from '../models/Program.js';
import Year from '../models/Year.js';
import Semester from '../models/Semester.js';
import { errorResponse, successResponse } from '../utils/apiResponse.js';
import { getPublicTeamMembers, getTeamMemberPhoto } from '../controllers/teamMemberController.js';
import { listPrograms } from '../controllers/programController.js';

const router = express.Router();

router.get('/team-members', getPublicTeamMembers);
router.get('/team-members/:id/photo', getTeamMemberPhoto);
router.get('/programs', listPrograms);

router.get('/departments', async (_req, res, next) => {
  try {
    const departments = await Department.find({
      $and: [
        { $or: [{ status: 'active' }, { status: { $exists: false } }] },
        { isActive: { $ne: false } }
      ]
    }).populate('programId').sort({ name: 1 });
    return res.status(200).json(successResponse('Active departments retrieved.', { departments }));
  } catch (error) {
    next(error);
  }
});

router.get('/years', async (req, res, next) => {
  try {
    const filter = {
      $and: [
        { $or: [{ status: 'active' }, { status: { $exists: false } }] },
        { isActive: { $ne: false } }
      ]
    };
    if (req.query.programId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.programId)) {
        return res.status(400).json(errorResponse('Invalid course id.', 'Bad Request', 400));
      }
      const program = await Program.findOne({ _id: req.query.programId, status: 'active' });
      if (!program) return res.status(404).json(errorResponse('Course not found.', 'Not Found', 404));
      filter.programId = program._id;
      if (program.durationYears) filter.academicLevel = { $lte: program.durationYears };
    }
    const years = await Year.find(filter).sort({ academicLevel: 1, order: 1, name: 1 });
    return res.status(200).json(successResponse('Active years retrieved.', { years }));
  } catch (error) {
    next(error);
  }
});

router.get('/semesters', async (req, res, next) => {
  try {
    const filter = {
      $and: [
        { $or: [{ status: 'active' }, { status: { $exists: false } }] },
        { isActive: { $ne: false } }
      ]
    };
    if (req.query.programId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.programId)) {
        return res.status(400).json(errorResponse('Invalid course id.', 'Bad Request', 400));
      }
      const program = await Program.findOne({ _id: req.query.programId, status: 'active' });
      if (!program) return res.status(404).json(errorResponse('Course not found.', 'Not Found', 404));
      const yearFilter = { programId: program._id };
      if (program.durationYears) yearFilter.academicLevel = { $lte: program.durationYears };
      const years = await Year.find(yearFilter).distinct('_id');
      filter.yearId = { $in: years };
      if (program.durationYears && program.semestersPerYear) {
        filter.number = { $lte: program.durationYears * program.semestersPerYear };
      }
    }
    const semesters = await Semester.find(filter).populate('yearId').sort({ number: 1, name: 1 });
    return res.status(200).json(successResponse('Active semesters retrieved.', { semesters }));
  } catch (error) {
    next(error);
  }
});

export default router;