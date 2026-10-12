import mongoose from 'mongoose';

const programSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    level: {
      type: String,
      required: true,
      enum: ['undergraduate', 'postgraduate', 'diploma']
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    durationYears: { type: Number, min: 1, max: 8, default: null },
    semestersPerYear: { type: Number, min: 1, max: 4, default: null },
    academicStructureSource: { type: String, trim: true, default: '' },
    academicStructureVerified: { type: Boolean, default: false },
    verificationStatus: {
      type: String,
      enum: ['pending-prospectus', 'prospectus-verified'],
      default: 'pending-prospectus'
    },
    officialSourceUrl: { type: String, trim: true, default: '' },
    officialSourceTitle: { type: String, trim: true, default: '' }
  },
  { timestamps: true }
);

programSchema.index({ level: 1, status: 1, name: 1 });

export default mongoose.model('Program', programSchema);