import app from './app.js';
import connectDB from './config/db.js';
import { env } from './config/env.js';
import { startMyraaService } from './services/myraaProcess.js';

const startServer = async () => {
  await connectDB();

  app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
    if (process.env.NODE_ENV !== 'production') startMyraaService();
  });
};

startServer();
