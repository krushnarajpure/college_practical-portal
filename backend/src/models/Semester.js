import mongoose from 'mongoose';

const semesterSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true, default: '' },
    number: { type: Number, required: true, default: 1 },
    yearId: { type: mongoose.Schema.Types.ObjectId, ref: 'Year', required: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

semesterSchema.pre('save', function (next) {
  if (this.status === 'inactive' && this.isActive !== false) this.isActive = false;
  if (this.status === 'active' && this.isActive !== true) this.isActive = true;
  next();
});

const Semester = mongoose.model('Semester', semesterSchema);

export default Semester;
