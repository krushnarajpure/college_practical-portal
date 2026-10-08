import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema(
  {
    driveFileId: { type: String, required: true, unique: true, trim: true },
    storageType: { type: String, enum: ['googleDrive', 'gridfs', 'mongodb', 'driveLink'], default: 'googleDrive', index: true },
    gridFsFileId: { type: mongoose.Schema.Types.ObjectId, default: null },
    filename: { type: String, default: '', trim: true, maxlength: 500 },
    originalName: { type: String, default: '', trim: true, maxlength: 500 },
    driveUrl: { type: String, default: '', trim: true, maxlength: 2048 },
    content: { type: String, default: '' },
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'NoteFolder', default: null, index: true },
    folderMovedByAdmin: { type: Boolean, default: false },
    title: { type: String, required: true, trim: true, maxlength: 500 },
    customTitle: { type: String, default: '', trim: true, maxlength: 500 },
    description: { type: String, default: '', trim: true, maxlength: 5000 },
    category: { type: String, default: 'General', trim: true, maxlength: 200 },
    fileType: { type: String, enum: ['pdf', 'document', 'spreadsheet', 'presentation', 'image', 'text', 'driveLink', 'other'], default: 'other' },
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
    accessType: { type: String, enum: ['free', 'paid'], default: 'free' },
    pricePaise: { type: Number, min: 0, default: 0 },
    isDeleted: { type: Boolean, default: false },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastSyncedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

noteSchema.index({ isActive: 1, category: 1, updatedAt: -1 });
noteSchema.index({ folderPath: 1, isDeleted: 1 });

export default mongoose.model('Note', noteSchema);
