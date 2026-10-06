import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    driveFileId: { type: String, required: true, unique: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 500 },
    customTitle: { type: String, default: '', trim: true, maxlength: 500 },
    description: { type: String, default: '', trim: true, maxlength: 5000 },
    category: { type: String, default: 'General', trim: true, maxlength: 200 },
    fileType: { type: String, enum: ['pdf', 'document', 'spreadsheet', 'presentation', 'image', 'text', 'other'], default: 'other' },
    mimeType: { type: String, default: 'application/octet-stream' },
    extension: { type: String, default: '', trim: true },
    size: { type: Number, default: 0, min: 0 },
    folderPath: { type: String, default: '', trim: true, maxlength: 2000 },
    folderPathSegments: { type: [String], default: [] },
    driveCreatedAt: { type: Date, default: null },
    driveUpdatedAt: { type: Date, default: null },
    viewMimeType: { type: String, default: 'application/pdf' },
    isActive: { type: Boolean, default: true },
    isPublic: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    lastSyncedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

noteSchema.index({ isActive: 1, category: 1, updatedAt: -1 });

export default mongoose.model('Note', noteSchema);
