import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    practicalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Practical', required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    yearId: { type: mongoose.Schema.Types.ObjectId, ref: 'Year', required: true },
    semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', required: true },
    attempt: { type: Number, required: true, default: 1 },
    submissionFile: {
      gridFsFileId: { type: mongoose.Schema.Types.ObjectId, default: null },
      originalFileName: { type: String, default: '' },
      mimeType: { type: String, default: '' },
      fileSize: { type: Number, default: 0 }
    },
    content: { type: String, default: '' },
    submissionDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['Pending', 'Submitted', 'Evaluated', 'Resubmission Required'], default: 'Submitted' },
    remarks: { type: String, default: '' }
  },
  { timestamps: true }
);

submissionSchema.index({ studentId: 1, practicalId: 1, attempt: 1 }, { unique: true });
submissionSchema.index({ practicalId: 1, status: 1 });

const Submission = mongoose.model('Submission', submissionSchema);

export default Submission;
