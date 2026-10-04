import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    practicalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Practical', default: null },
    action: { type: String, default: 'update' },
    entityType: { type: String, default: 'general' },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
