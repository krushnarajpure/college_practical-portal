import dotenv from 'dotenv';

dotenv.config();

const maxPdfSizeMb = Number(process.env.MAX_PDF_SIZE_MB) || 25;

export const env = {
  port: process.env.PORT || 5000,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET || 'development_secret',
  aiApiKey: process.env.GEMINI_API_KEY || process.env.AI_API_KEY || 'placeholder_ai_key',
  maxAcademicDocumentSizeBytes: (Number(process.env.MAX_ACADEMIC_DOCUMENT_SIZE_MB) || 25) * 1024 * 1024,
  frontendUrl: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://college-practical-portal.vercel.app' : 'http://localhost:5173'),
  maxPdfSizeBytes: maxPdfSizeMb * 1024 * 1024
};
