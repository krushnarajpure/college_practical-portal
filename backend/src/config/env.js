import dotenv from 'dotenv';

dotenv.config();

const maxPdfSizeMb = Number(process.env.MAX_PDF_SIZE_MB) || 25;

export const env = {
  port: process.env.PORT || 5000,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET || 'development_secret',
  aiApiKey: process.env.AI_API_KEY || 'placeholder_ai_key',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  maxPdfSizeBytes: maxPdfSizeMb * 1024 * 1024
};
