import mongoose from 'mongoose';

const bookmarkSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    practicalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Practical', required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

bookmarkSchema.index({ userId: 1, practicalId: 1 }, { unique: true });

const Bookmark = mongoose.model('Bookmark', bookmarkSchema);

export default Bookmark;
