import mongoose from 'mongoose';
import TeamMember from '../models/TeamMember.js';
import { errorResponse, successResponse } from '../utils/apiResponse.js';
import { getProfilePhotoBucket } from '../config/storage.js';
import { logger } from '../utils/logger.js';

const allowedFields = ['name', 'title', 'bio', 'email', 'profileUrl'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const deletePhoto = async (photoId) => {
  if (photoId) await getProfilePhotoBucket().delete(photoId);
};

const cleanupPhoto = async (photoId, context) => {
  if (!photoId) return;
  try {
    await deletePhoto(photoId);
  } catch (error) {
    logger.warn('Unable to clean up team member photo', { context, photoId: String(photoId), error: error.message });
  }
};

function validateMemberInput(body, partial = false) {
  const input = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const values = Object.fromEntries(
    allowedFields
      .filter((field) => Object.hasOwn(input, field))
      .map((field) => [field, typeof input[field] === 'string' ? input[field].trim() : input[field]])
  );

  if (!partial && (!values.name || !values.title)) {
    return 'Name and role are required.';
  }
  if (partial && (('name' in values && !values.name) || ('title' in values && !values.title))) {
    return 'Name and role cannot be empty.';
  }
  if (values.email && !emailPattern.test(values.email)) {
    return 'Enter a valid email address.';
  }
  if (values.profileUrl) {
    try {
      const url = new URL(values.profileUrl);
      if (!['http:', 'https:'].includes(url.protocol)) return 'Profile link must use http or https.';
    } catch {
      return 'Enter a valid profile link.';
    }
  }

  return values;
}

export const getPublicTeamMembers = async (_req, res, next) => {
  try {
    const records = await TeamMember.find().sort({ createdAt: 1, name: 1 }).lean();
    const members = records.map(({ _id, name, title, bio, email, profileUrl, profilePhotoId, updatedAt }) => ({
      _id,
      name,
      title,
      bio,
      email,
      profileUrl,
      updatedAt,
      hasPhoto: Boolean(profilePhotoId)
    }));
    return res.status(200).json(successResponse('Team members retrieved.', { members }));
  } catch (error) {
    return next(error);
  }
};

export const getTeamMemberPhoto = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse('Invalid team member id.', 'Bad Request', 400));
    }
    const member = await TeamMember.findById(req.params.id).select('profilePhotoId');
    if (!member?.profilePhotoId) {
      return res.status(404).json(errorResponse('No team member photo is available.', 'Not Found', 404));
    }

    const bucket = getProfilePhotoBucket();
    const file = await bucket.find({ _id: member.profilePhotoId }).next();
    if (!file) return res.status(404).json(errorResponse('No team member photo is available.', 'Not Found', 404));

    res.setHeader('Content-Type', file.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=300');
    const downloadStream = bucket.openDownloadStream(member.profilePhotoId);
    downloadStream.on('error', (error) => {
      if (!res.headersSent) next(error);
      else res.destroy(error);
    });
    downloadStream.pipe(res);
  } catch (error) {
    return next(error);
  }
};

export const getTeamMembers = async (_req, res, next) => {
  try {
    const members = await TeamMember.find().sort({ createdAt: 1, name: 1 }).lean();
    return res.status(200).json(successResponse('Team members retrieved.', { members }));
  } catch (error) {
    return next(error);
  }
};

export const createTeamMember = async (req, res, next) => {
  try {
    if (!req.file?.id) {
      return res.status(400).json(errorResponse('Add a profile photo before creating a team member.', 'InvalidTeamMember', 400));
    }
    const values = validateMemberInput(req.body);
    if (typeof values === 'string') {
      await cleanupPhoto(req.file?.id, 'invalid create request');
      return res.status(400).json(errorResponse(values, 'InvalidTeamMember', 400));
    }
    if (req.file?.id) values.profilePhotoId = req.file.id;
    const member = await TeamMember.create(values);
    return res.status(201).json(successResponse('Team member added.', { member }));
  } catch (error) {
    await cleanupPhoto(req.file?.id, 'failed create request');
    return next(error);
  }
};

export const updateTeamMember = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      await cleanupPhoto(req.file?.id, 'invalid update id');
      return res.status(400).json(errorResponse('Invalid team member id.', 'Bad Request', 400));
    }
    const existingMember = await TeamMember.findById(req.params.id);
    if (!existingMember) {
      await cleanupPhoto(req.file?.id, 'missing update target');
      return res.status(404).json(errorResponse('Team member not found.', 'Not Found', 404));
    }
    const values = validateMemberInput(req.body, true);
    if (typeof values === 'string') {
      await cleanupPhoto(req.file?.id, 'invalid update request');
      return res.status(400).json(errorResponse(values, 'InvalidTeamMember', 400));
    }
    if (req.file?.id) values.profilePhotoId = req.file.id;
    if (!Object.keys(values).length) {
      await cleanupPhoto(req.file?.id, 'empty update request');
      return res.status(400).json(errorResponse('Provide at least one team member field to update.', 'InvalidTeamMember', 400));
    }

    const member = await TeamMember.findByIdAndUpdate(req.params.id, values, { new: true, runValidators: true });
    if (!member) {
      await cleanupPhoto(req.file?.id, 'failed update request');
      return res.status(404).json(errorResponse('Team member not found.', 'Not Found', 404));
    }
    if (req.file?.id && existingMember.profilePhotoId) {
      await cleanupPhoto(existingMember.profilePhotoId, 'replaced team member photo');
    }
    return res.status(200).json(successResponse('Team member updated.', { member }));
  } catch (error) {
    await cleanupPhoto(req.file?.id, 'failed update request');
    return next(error);
  }
};

export const deleteTeamMember = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json(errorResponse('Invalid team member id.', 'Bad Request', 400));
    }
    const member = await TeamMember.findByIdAndDelete(req.params.id);
    if (!member) return res.status(404).json(errorResponse('Team member not found.', 'Not Found', 404));
    await cleanupPhoto(member.profilePhotoId, 'deleted team member');
    return res.status(200).json(successResponse('Team member removed.', {}));
  } catch (error) {
    return next(error);
  }
};
