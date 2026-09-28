import mongoose from 'mongoose';
import Bookmark from '../models/Bookmark.js';
import Practical from '../models/Practical.js';
import User from '../models/User.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

async function getStudent(userId) {
  const user = await User.findById(userId).select('status departmentId yearId semesterId');
  if (!user || user.status !== 'active' || !user.departmentId || !user.yearId || !user.semesterId) return null;
  return user;
}

export const getBookmarks = async (req, res, next) => {
  try {
    const student = await getStudent(req.user.id);
    if (!student) return res.status(200).json(successResponse('Bookmarks retrieved.', { bookmarks: [] }));
    const records = await Bookmark.find({ userId: student._id })
      .populate({
        path: 'practicalId',
        match: { departmentId: student.departmentId, yearId: student.yearId, semesterId: student.semesterId, status: 'published' },
        populate: ['subjectId', 'departmentId', 'yearId', 'semesterId']
      })
      .sort({ createdAt: -1 });
    return res.status(200).json(successResponse('Bookmarks retrieved.', { bookmarks: records.filter((item) => item.practicalId) }));
  } catch (error) {
    next(error);
  }
};

export const addBookmark = async (req, res, next) => {
  try {
    const { practicalId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(practicalId)) return res.status(400).json(errorResponse('Invalid practical id.', 'Bad Request', 400));
    const student = await getStudent(req.user.id);
    if (!student) return res.status(403).json(errorResponse('Student academic mapping is missing or inactive.', 'Forbidden', 403));
    const practical = await Practical.findOne({ _id: practicalId, departmentId: student.departmentId, yearId: student.yearId, semesterId: student.semesterId, status: 'published' });
    if (!practical) return res.status(404).json(errorResponse('Published practical not found for your academic mapping.', 'Not Found', 404));
    const bookmark = await Bookmark.findOneAndUpdate(
      { userId: student._id, practicalId: practical._id },
      { $setOnInsert: { userId: student._id, practicalId: practical._id } },
      { new: true, upsert: true, runValidators: true }
    ).populate({ path: 'practicalId', populate: ['subjectId', 'departmentId', 'yearId', 'semesterId'] });
    return res.status(200).json(successResponse('Bookmark added.', { bookmark }));
  } catch (error) {
    next(error);
  }
};

export const removeBookmark = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.practicalId)) return res.status(400).json(errorResponse('Invalid practical id.', 'Bad Request', 400));
    await Bookmark.deleteOne({ userId: req.user.id, practicalId: req.params.practicalId });
    return res.status(200).json(successResponse('Bookmark removed.', { practicalId: req.params.practicalId }));
  } catch (error) {
    next(error);
  }
};
