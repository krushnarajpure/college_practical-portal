import mongoose from 'mongoose';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import Notification from '../models/Notification.js';

export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .populate('actorId', 'name role')
      .sort({ createdAt: -1 })
      .limit(100);
    return res.status(200).json(successResponse('Notifications retrieved.', { notifications }));
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse('Invalid notification id.', 'Bad Request', 400));
    }
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { read: true } },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json(errorResponse('Notification not found.', 'Not Found', 404));
    }
    return res.status(200).json(successResponse('Notification marked as read.', { notificationId: req.params.id }));
  } catch (error) {
    next(error);
  }
};
