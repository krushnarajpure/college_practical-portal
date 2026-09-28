import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import { env } from './env.js';

export const storageConfig = {
  bucketName: 'practicalPDFs',
  maxFileSize: env.maxPdfSizeBytes ?? 25 * 1024 * 1024,
  allowedMimeTypes: ['application/pdf'],
  supportedExtensions: ['.pdf']
};

let practicalPdfBucket;

export function initializeGridFSBucket(db = mongoose.connection.db) {
  if (!db) throw new Error('MongoDB must be connected before initializing GridFS.');
  practicalPdfBucket = new GridFSBucket(db, { bucketName: storageConfig.bucketName });
  return practicalPdfBucket;
}

export function getGridFSBucket() {
  if (practicalPdfBucket) return practicalPdfBucket;
  if (mongoose.connection.db) return initializeGridFSBucket(mongoose.connection.db);
  throw Object.assign(new Error('GridFS is unavailable because MongoDB is not connected.'), {
    name: 'MongoNotConnectedError',
    statusCode: 503
  });
}
