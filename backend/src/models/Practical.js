import mongoose from 'mongoose';

const practicalSchema = new mongoose.Schema(
  {
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    yearId: { type: mongoose.Schema.Types.ObjectId, ref: 'Year', required: true },
    semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true },
    practicalNumber: { type: Number, required: true },
    title: { type: String, required: true },
    pdfId: { type: mongoose.Schema.Types.ObjectId, ref: 'PDF', default: null },
    aim: { type: String, default: '' },
    about: { type: String, default: '' },
    objectives: [{ type: String }],
    requirements: [{ type: String }],
    theory: { type: String, default: '' },
    procedure: [{ type: String }],
    task: { type: String, default: '' },
    expectedOutput: { type: String, default: '' },
    importantPoints: [{ type: String }],
    commonErrors: [{ type: String }],
    vivaQuestions: [{ type: String }],
    aiGenerated: { type: Boolean, default: false },
    teacherApproved: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['draft', 'published', 'unpublished', 'archived'],
      default: 'draft'
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publishedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

practicalSchema.index({ pdfId: 1 });

const Practical = mongoose.model('Practical', practicalSchema);

export default Practical;
