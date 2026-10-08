import dotenv from 'dotenv';

dotenv.config();

const toServiceAccountJson = () => {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !privateKey) {
    return process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '';
  }

  const normalizedKey = privateKey
    .replace(/^"|"$/g, '')
    .replace(/\\n/g, '\n');

  return JSON.stringify({
    type: 'service_account',
    project_id: process.env.GOOGLE_PROJECT_ID || '',
    private_key_id: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID || '',
    private_key: `-----BEGIN PRIVATE KEY-----\n${normalizedKey.replace(/^-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----$/g, '').trim()}\n-----END PRIVATE KEY-----\n`,
    client_email: email,
    client_id: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID || '',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_X509_CERT_URL || `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(email)}`
  });
};

const maxPdfSizeMb = Number(process.env.MAX_PDF_SIZE_MB) || 25;
const pdfPageRenderDpi = Math.min(600, Math.max(150, Number(process.env.PDF_PAGE_RENDER_DPI) || 300));
const configuredMongoStorageLimitMb = Number(process.env.MONGODB_STORAGE_LIMIT_MB);
const mongoStorageLimitMb = configuredMongoStorageLimitMb;

export const env = {
  port: process.env.PORT || 5000,
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET || 'development_secret',
  aiApiKey: process.env.GEMINI_API_KEY || process.env.AI_API_KEY || 'placeholder_ai_key',
  maxAcademicDocumentSizeBytes: (Number(process.env.MAX_ACADEMIC_DOCUMENT_SIZE_MB) || 25) * 1024 * 1024,
  frontendUrl: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://college-practical-portal.vercel.app' : 'http://localhost:5173'),
  maxPdfSizeBytes: maxPdfSizeMb * 1024 * 1024,
  mongoStorageLimitMb: Number.isFinite(mongoStorageLimitMb) && mongoStorageLimitMb > 0 ? mongoStorageLimitMb : null,
  mongoStorageLimitSource: Number.isFinite(configuredMongoStorageLimitMb) && configuredMongoStorageLimitMb > 0 ? 'configured' : 'not-configured',
  pdfPageRenderDpi,
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  googleServiceAccountJson: toServiceAccountJson() || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
  googleServiceAccountFile: process.env.GOOGLE_SERVICE_ACCOUNT_FILE || '',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || ''
};
