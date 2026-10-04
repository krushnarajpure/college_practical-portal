import Notification from '../models/Notification.js';
import User from '../models/User.js';

const notificationService = {
  async createAdminActivity({ actorId, action, entityType, entityId, practicalId = null, message }) {
    const admins = await User.find({ role: 'admin', status: 'active' }).select('_id');
    if (!admins.length) return;
    await Notification.insertMany(admins.map((admin) => ({
      userId: admin._id,
      actorId,
      action,
      entityType,
      entityId,
      practicalId,
      message
    })));
  }
};

export default notificationService;
