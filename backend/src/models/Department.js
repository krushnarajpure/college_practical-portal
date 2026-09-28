import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true, default: '' },
    description: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

departmentSchema.pre('save', function (next) {
  if (this.status === 'inactive' && this.isActive !== false) this.isActive = false;
  if (this.status === 'active' && this.isActive !== true) this.isActive = true;
  next();
});

const Department = mongoose.model('Department', departmentSchema);

export default Department;
