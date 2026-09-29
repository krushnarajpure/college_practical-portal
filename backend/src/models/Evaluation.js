import mongoose from 'mongoose';

const evaluationSchema = new mongoose.Schema(
  {
    submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Submission', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    practicalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Practical', required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    yearId: { type: mongoose.Schema.Types.ObjectId, ref: 'Year', required: true },
    semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true },
    marksObtained: { type: Number, min: 0, required: true },
    maximumMarks: { type: Number, min: 1, required: true },
    passingMarks: { type: Number, min: 0, required: true },
    percentage: { type: Number, min: 0, max: 100, required: true },
    resultStatus: { type: String, enum: ['PENDING', 'PASS', 'FAIL'], required: true },
    remarks: { type: String, default: '' },
    marksBreakdown: { type: mongoose.Schema.Types.Mixed, default: null },
    evaluatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

evaluationSchema.index({ submissionId: 1 }, { unique: true });
evaluationSchema.index({ studentId: 1, practicalId: 1 });

const Evaluation = mongoose.model('Evaluation', evaluationSchema);

export default Evaluation;
