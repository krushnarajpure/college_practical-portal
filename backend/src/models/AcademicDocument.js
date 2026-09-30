import mongoose from 'mongoose';

const storedFileSchema = new mongoose.Schema({
  fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  fileName: { type: String, required: true },
  mimeType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  pageCount: { type: Number, default: null }
}, { _id: false });

const editChangeSchema = new mongoose.Schema({
  itemId: { type: String, default: null },
  field: { type: String, required: true, maxlength: 160 },
  oldText: { type: String, default: '', maxlength: 1000 },
  newText: { type: String, required: true, maxlength: 1000 },
  pageNumber: { type: Number, default: null },
  x: { type: Number, default: null },
  y: { type: Number, default: null },
  width: { type: Number, default: null },
  height: { type: Number, default: null },
  fontSize: { type: Number, default: null }
}, { _id: false });

const versionSchema = new mongoose.Schema({
  fileId: { type: mongoose.Schema.Types.ObjectId, required: true },
  fileName: { type: String, required: true },
  mimeType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  editType: { type: String, enum: ['manual', 'ai', 'converted'], required: true },
  instruction: { type: String, default: '' },
  changes: { type: [editChangeSchema], default: [] },
  createdAt: { type: Date, default: Date.now }
});

const academicDocumentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, default: '', maxlength: 2000 },
  type: { type: String, required: true, enum: ['Assignment', 'Certificate', 'Index', 'Practical', 'Notes', 'Other Document'] },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  yearId: { type: mongoose.Schema.Types.ObjectId, ref: 'Year', required: true },
  semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true },
  originalFile: { type: storedFileSchema, required: true },
  versions: { type: [versionSchema], default: [] },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedByName: { type: String, default: 'Teacher', trim: true },
  uploadedByRole: { type: String, enum: ['teacher', 'admin'], default: 'teacher' },
  uploadedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['draft', 'published'], default: 'published' },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

academicDocumentSchema.index({ isActive: 1, status: 1, departmentId: 1, yearId: 1, semesterId: 1 });
academicDocumentSchema.index({ uploadedBy: 1, createdAt: -1 });

export default mongoose.model('AcademicDocument', academicDocumentSchema);