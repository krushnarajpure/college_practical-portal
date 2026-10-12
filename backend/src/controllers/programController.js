import mongoose from 'mongoose';
import Department from '../models/Department.js';
import Program from '../models/Program.js';
import Subject from '../models/Subject.js';
import User from '../models/User.js';
import Year from '../models/Year.js';
import Semester from '../models/Semester.js';
import { errorResponse, successResponse } from '../utils/apiResponse.js';
import { ensureProgramAcademicStructure } from '../services/programAcademicStructure.js';

const validLevels = new Set(['undergraduate', 'postgraduate', 'diploma']);
const normalizeProgram = (body) => ({
  name: String(body.name || '').trim(),
  level: body.level,
  status: body.status === 'inactive' ? 'inactive' : 'active',
  durationYears: body.durationYears === '' || body.durationYears == null ? null : Number(body.durationYears),
  semestersPerYear: body.semestersPerYear === '' || body.semestersPerYear == null ? null : Number(body.semestersPerYear),
  academicStructureSource: String(body.academicStructureSource || '').trim(),
  academicStructureVerified: body.academicStructureVerified === true,
  verificationStatus: body.verificationStatus === 'prospectus-verified' ? 'prospectus-verified' : 'pending-prospectus',
  officialSourceUrl: String(body.officialSourceUrl || '').trim(),
  officialSourceTitle: String(body.officialSourceTitle || '').trim()
});

const validateProgram = (program) => {
  if (!program.name || !validLevels.has(program.level)) return 'A course name and valid course level are required.';
  if (program.durationYears !== null && (!Number.isInteger(program.durationYears) || program.durationYears < 1 || program.durationYears > 8)) {
    return 'Duration must be a whole number from 1 to 8 years.';
  }
  if (program.semestersPerYear !== null && (!Number.isInteger(program.semestersPerYear) || program.semestersPerYear < 1 || program.semestersPerYear > 4)) {
    return 'Semesters per year must be a whole number from 1 to 4.';
  }
  if (program.academicStructureVerified && (!program.durationYears || !program.semestersPerYear || !/^https?:\/\/\S+$/i.test(program.academicStructureSource))) {
    return 'Verified academic structure requires duration, semesters per year, and an official regulation URL.';
  }
  if (program.verificationStatus === 'prospectus-verified' && !program.officialSourceUrl) {
    return 'Prospectus verification requires an official source URL.';
  }
  return '';
};

export const listPrograms = async (req, res, next) => {
  try {
    const filter = req.query?.status === 'all' && req.user?.role === 'admin' ? {} : { status: 'active' };
    const programs = await Program.find(filter).sort({ level: 1, name: 1 }).lean();
    const programIds = programs.map(({ _id }) => _id);
    const departmentFilter = { programId: { $in: programIds } };
    if (!(req.query?.status === 'all' && req.user?.role === 'admin')) departmentFilter.status = 'active';
    const departments = await Department.find(departmentFilter).sort({ name: 1 }).lean();
    const departmentIds = departments.map(({ _id }) => _id);
    const [enrollments, subjectCounts, allYears] = await Promise.all([
      User.aggregate([
        { $match: { role: 'student', departmentId: { $in: departmentIds } } },
        { $group: { _id: '$departmentId', count: { $sum: 1 } } }
      ]),
      Subject.aggregate([
        { $match: { departmentId: { $in: departmentIds } } },
        { $group: { _id: '$departmentId', count: { $sum: 1 } } }
      ]),
      Year.find({
        programId: { $in: programIds },
        ...(req.query?.status === 'all' && req.user?.role === 'admin' ? {} : { status: 'active' })
      }).sort({ order: 1, academicLevel: 1 }).lean()
    ]);
    const programById = new Map(programs.map((program) => [String(program._id), program]));
    const years = allYears.filter((year) => {
      const program = programById.get(String(year.programId));
      return !program?.durationYears || !year.academicLevel || year.academicLevel <= program.durationYears;
    });
    const semesters = await Semester.find({
      yearId: { $in: years.map(({ _id }) => _id) },
      ...(req.query?.status === 'all' && req.user?.role === 'admin' ? {} : { status: 'active' })
    }).sort({ number: 1 }).lean();
    const semestersInStructure = semesters.filter((semester) => {
      const year = years.find((item) => String(item._id) === String(semester.yearId));
      const program = year && programById.get(String(year.programId));
      const maxSemester = Number(program?.durationYears || 0) * Number(program?.semestersPerYear || 0);
      return !maxSemester || semester.number <= maxSemester;
    });
    const semestersByYear = new Map();
    for (const semester of semestersInStructure) {
      const entries = semestersByYear.get(String(semester.yearId)) || [];
      entries.push(semester);
      semestersByYear.set(String(semester.yearId), entries);
    }
    const yearsByProgram = new Map();
    for (const year of years) {
      const programId = String(year.programId);
      const entries = yearsByProgram.get(programId) || [];
      entries.push({ ...year, semesters: semestersByYear.get(String(year._id)) || [] });
      yearsByProgram.set(programId, entries);
    }
    const enrollmentByDepartment = new Map(enrollments.map(({ _id, count }) => [String(_id), count]));
    const subjectCountByDepartment = new Map(subjectCounts.map(({ _id, count }) => [String(_id), count]));
    const branchesByProgram = new Map();
    for (const department of departments) {
      const programId = String(department.programId);
      const branches = branchesByProgram.get(programId) || [];
      branches.push({
        ...department,
        enrollmentCount: enrollmentByDepartment.get(String(department._id)) || 0,
        subjectCount: subjectCountByDepartment.get(String(department._id)) || 0
      });
      branchesByProgram.set(programId, branches);
    }
    return res.status(200).json(successResponse('Course catalog retrieved.', {
      programs: programs.map((program) => ({
        ...program,
        branches: branchesByProgram.get(String(program._id)) || [],
        years: yearsByProgram.get(String(program._id)) || []
      }))
    }));
  } catch (error) {
    next(error);
  }
};

export const createProgram = async (req, res, next) => {
  try {
    const program = normalizeProgram(req.body);
    const validationError = validateProgram(program);
    if (validationError) return res.status(400).json(errorResponse(validationError, 'Bad Request', 400));
    const created = await Program.create(program);
    await ensureProgramAcademicStructure(created);
    return res.status(201).json(successResponse('Course created.', { program: created }));
  } catch (error) {
    next(error);
  }
};

export const updateProgram = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse('Invalid course id.', 'Bad Request', 400));
    }
    const program = normalizeProgram(req.body);
    const validationError = validateProgram(program);
    if (validationError) return res.status(400).json(errorResponse(validationError, 'Bad Request', 400));
    const updated = await Program.findByIdAndUpdate(req.params.id, program, { new: true, runValidators: true });
    if (!updated) return res.status(404).json(errorResponse('Course not found.', 'Not Found', 404));
    await ensureProgramAcademicStructure(updated);
    return res.status(200).json(successResponse('Course updated.', { program: updated }));
  } catch (error) {
    next(error);
  }
};

export const deleteProgram = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse('Invalid course id.', 'Bad Request', 400));
    }
    const program = await Program.findById(req.params.id);
    if (!program) return res.status(404).json(errorResponse('Course not found.', 'Not Found', 404));
    if (await Department.exists({ programId: program._id })) {
      return res.status(409).json(errorResponse('Deactivate this course instead; branches are linked to it.', 'Conflict', 409));
    }
    await program.deleteOne();
    return res.status(200).json(successResponse('Course deleted.', {}));
  } catch (error) {
    next(error);
  }
};