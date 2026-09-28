import mongoose from 'mongoose';
import { env } from './env.js';
import { initializeGridFSBucket } from './storage.js';
import { seedAcademicLevels } from './seedAcademicLevels.js';

const connectDB = async () => {
  try {
    if (!env.mongodbUri) {
      throw new Error('MONGODB_URI must be configured for MongoDB Atlas.');
    }

    const conn = await mongoose.connect(env.mongodbUri, { dbName: 'college_practical_portal' });
    initializeGridFSBucket(conn.connection.db);
    await seedAcademicLevels();
    console.log('MongoDB connected successfully');
    return conn;
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};

export default connectDB;
