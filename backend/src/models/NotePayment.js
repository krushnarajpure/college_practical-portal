import mongoose from 'mongoose';

const notePaymentSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true, index: true },
    razorpayOrderId: { type: String, required: true, unique: true },
    razorpayPaymentId: { type: String, default: undefined, unique: true, sparse: true },
    amountPaise: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ['INR'], default: 'INR' },
    status: { type: String, enum: ['pending', 'captured', 'failed'], default: 'pending', index: true },
    capturedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

notePaymentSchema.index({ studentId: 1, noteId: 1, status: 1 });

export default mongoose.model('NotePayment', notePaymentSchema);
