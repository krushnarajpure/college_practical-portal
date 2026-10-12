import mongoose from 'mongoose';

const pageSettingSchema = new mongoose.Schema(
  {
    pageId: { type: String, required: true, unique: true, trim: true, lowercase: true },
    pageName: { type: String, required: true, trim: true },
    dashboardType: { type: String, enum: ['student', 'teacher', 'both'], required: true, lowercase: true },
    isVisible: { type: Boolean, default: true },
    maintenanceMessage: { type: String, trim: true, default: '' },
    maintenanceUntil: { type: Date, default: null },
    reopenedAt: { type: Date, default: null },
    reopenNotificationSentAt: { type: Date, default: null }
  },
  { timestamps: true }
);

const PageSetting = mongoose.model('PageSetting', pageSettingSchema);

export default PageSetting;