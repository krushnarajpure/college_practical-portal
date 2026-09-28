import mongoose from 'mongoose';

const yearSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true, default: '' },
    order: { type: Number, default: 1 },
    academicLevel: { type: Number, enum: [1, 2, 3, 4], default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

yearSchema.pre('save', function (next) {
  if (this.status === 'inactive' && this.isActive !== false) this.isActive = false;
  if (this.status === 'active' && this.isActive !== true) this.isActive = true;
  next();
});

const Year = mongoose.model('Year', yearSchema);

export default Year;
