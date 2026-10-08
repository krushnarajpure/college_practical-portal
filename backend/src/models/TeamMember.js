import mongoose from 'mongoose';

const teamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    bio: { type: String, trim: true, maxlength: 500, default: '' },
    email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
    profileUrl: { type: String, trim: true, maxlength: 500, default: '' },
    profilePhotoId: { type: mongoose.Schema.Types.ObjectId, default: null }
  },
  { timestamps: true }
);

const TeamMember = mongoose.model('TeamMember', teamMemberSchema);

export default TeamMember;
