import mongoose from 'mongoose';

const progressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    practicalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Practical', required: true },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

progressSchema.index({ userId: 1, practicalId: 1 }, { unique: true });

const Progress = mongoose.model('Progress', progressSchema);

export default Progress;
