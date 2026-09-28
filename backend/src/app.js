
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import teacherRoutes from './routes/teacherRoutes.js';
import studentRoutes from './routes/studentRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import yearRoutes from './routes/yearRoutes.js';
import semesterRoutes from './routes/semesterRoutes.js';
import subjectRoutes from './routes/subjectRoutes.js';
import practicalRoutes from './routes/practicalRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import bookmarkRoutes from './routes/bookmarkRoutes.js';
import progressRoutes from './routes/progressRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import myraaRoutes from './routes/myraaRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import { notFoundHandler, errorMiddleware } from './middleware/errorMiddleware.js';

const app = express();

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true
  })
);
app.use(helmet());
app.use(morgan('dev'));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: {
      success: false,
      message: 'Too many requests. Please try again later.',
      error: 'RateLimitExceeded'
    }
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'College Practical Portal API is running.',
    data: {
      app: 'college-practical-portal-backend',
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/years', yearRoutes);
app.use('/api/semesters', semesterRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/practicals', practicalRoutes);
app.use('/api/pdfs', pdfRoutes);
app.use('/api/bookmarks', bookmarkRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/myraa', myraaRoutes);

app.use(notFoundHandler);
app.use(errorMiddleware);

export default app;
