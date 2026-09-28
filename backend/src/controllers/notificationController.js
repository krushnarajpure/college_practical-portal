import { successResponse } from '../utils/apiResponse.js';

export const getNotifications = async (req, res) => {
  return res.status(200).json(successResponse('Notifications retrieved.', { notifications: [] }));
};

export const markNotificationRead = async (req, res) => {
  return res.status(200).json(successResponse('Notification marked as read.', { notificationId: req.params.id }));
};
