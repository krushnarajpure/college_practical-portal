import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    branchName: { type: String, trim: true, default: '' },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    description: { type: String, default: '' },
    programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program', default: null, index: true },
    verificationStatus: {
      type: String,
      enum: ['pending-prospectus', 'prospectus-verified'],
      default: 'pending-prospectus'
    },
    officialSourceUrl: { type: String, trim: true, default: '' },
    officialSourceTitle: { type: String, trim: true, default: '' },
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
