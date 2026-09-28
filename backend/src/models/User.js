import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin', 'teacher', 'student'],
      required: true
    },
    studentId: { type: String, default: '' },
    employeeId: { type: String, default: '' },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    yearId: { type: mongoose.Schema.Types.ObjectId, ref: 'Year', default: null },
    semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester', default: null },
    assignedSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
    status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'active' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema);

export default User;
