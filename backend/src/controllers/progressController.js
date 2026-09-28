import mongoose from 'mongoose';
import Progress from '../models/Progress.js';
import Practical from '../models/Practical.js';
import User from '../models/User.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

async function getStudentMapping(userId) {
  const user = await User.findById(userId).select('status departmentId yearId semesterId');
  if (!user || user.status !== 'active') return null;
  if (!user.departmentId || !user.yearId || !user.semesterId) return null;
  return { user, mapping: { departmentId: user.departmentId, yearId: user.yearId, semesterId: user.semesterId } };
}

export const getProgress = async (req, res, next) => {
  try {
    const progress = await Progress.find({ userId: req.user.id, completed: true })
      .populate({ path: 'practicalId', select: 'title practicalNumber status subjectId departmentId yearId semesterId' })
      .sort({ completedAt: -1 });
    return res.status(200).json(successResponse('Progress retrieved.', { progress }));
  } catch (error) {
    next(error);
  }
};

export const markComplete = async (req, res, next) => {
  try {
    const { practicalId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(practicalId)) {
      return res.status(400).json(errorResponse('Invalid practical id.', 'Bad Request', 400));
    }
    const student = await getStudentMapping(req.user.id);
    if (!student) return res.status(403).json(errorResponse('Student academic mapping is missing or inactive.', 'Forbidden', 403));
    const practical = await Practical.findOne({ _id: practicalId, ...student.mapping, status: 'published' });
    if (!practical) return res.status(404).json(errorResponse('Published practical not found for your academic mapping.', 'Not Found', 404));

    const progress = await Progress.findOneAndUpdate(
      { userId: student.user._id, practicalId: practical._id },
      { $set: { completed: true, completedAt: new Date() } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return res.status(200).json(successResponse('Practical marked as completed.', { progress }));
  } catch (error) {
    next(error);
  }
};

export const removeComplete = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.practicalId)) {
      return res.status(400).json(errorResponse('Invalid practical id.', 'Bad Request', 400));
    }
    await Progress.deleteOne({ userId: req.user.id, practicalId: req.params.practicalId });
    return res.status(200).json(successResponse('Practical marked as incomplete.', { practicalId: req.params.practicalId }));
  } catch (error) {
    next(error);
  }
};