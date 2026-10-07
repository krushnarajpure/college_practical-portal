import mongoose from 'mongoose';

const noteFolderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'NoteFolder', default: null, index: true },
    path: { type: String, required: true, trim: true, maxlength: 2000, unique: true },
    sourcePath: { type: String, default: undefined, trim: true, maxlength: 2000 },
    source: { type: String, enum: ['admin', 'googleDrive'], default: 'admin' },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
);

noteFolderSchema.index({ parentId: 1, name: 1 });
noteFolderSchema.index({ sourcePath: 1 }, { unique: true, sparse: true });

export default mongoose.model('NoteFolder', noteFolderSchema);
