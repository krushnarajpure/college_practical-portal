import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import { env } from './env.js';

export const storageConfig = {
  bucketName: 'practicalPDFs',
  profilePhotoBucketName: 'profilePhotos',
  maxFileSize: env.maxPdfSizeBytes ?? 25 * 1024 * 1024,
  profilePhotoMaxFileSize: 5 * 1024 * 1024,
  allowedMimeTypes: ['application/pdf'],
  supportedExtensions: ['.pdf'],
  profilePhotoAllowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  profilePhotoSupportedExtensions: ['.jpg', '.jpeg', '.png', '.webp']
};

let practicalPdfBucket;
let profilePhotoBucket;

export function initializeGridFSBucket(db = mongoose.connection.db) {
  if (!db) throw new Error('MongoDB must be connected before initializing GridFS.');
  practicalPdfBucket = new GridFSBucket(db, { bucketName: storageConfig.bucketName });
  return practicalPdfBucket;
}

export function initializeProfilePhotoBucket(db = mongoose.connection.db) {
  if (!db) throw new Error('MongoDB must be connected before initializing GridFS.');
  profilePhotoBucket = new GridFSBucket(db, { bucketName: storageConfig.profilePhotoBucketName });
  return profilePhotoBucket;
}

export function getGridFSBucket() {
  if (practicalPdfBucket) return practicalPdfBucket;
  if (mongoose.connection.db) return initializeGridFSBucket(mongoose.connection.db);
  throw Object.assign(new Error('GridFS is unavailable because MongoDB is not connected.'), {
    name: 'MongoNotConnectedError',
    statusCode: 503
  });
}

export function getProfilePhotoBucket() {
  if (profilePhotoBucket) return profilePhotoBucket;
  if (mongoose.connection.db) return initializeProfilePhotoBucket(mongoose.connection.db);
  throw Object.assign(new Error('Profile photo storage is unavailable because MongoDB is not connected.'), {
    name: 'MongoNotConnectedError',
    statusCode: 503
  });
}
