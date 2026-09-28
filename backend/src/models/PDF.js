import mongoose from 'mongoose';

const pdfSchema = new mongoose.Schema(
  {
    practicalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Practical', required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    gridFsFileId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
    gridFsFileName: { type: String, required: true },
    originalFileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, enum: ['application/pdf'], default: 'application/pdf' },
    fileSize: { type: Number, required: true, min: 0 },
    uploadedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

pdfSchema.index({ practicalId: 1 });
pdfSchema.index({ uploadedBy: 1 });

const PDF = mongoose.model('PDF', pdfSchema);

export default PDF;
