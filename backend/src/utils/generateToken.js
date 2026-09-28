import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role
    },
    env.jwtSecret,
    { expiresIn: '7d' }
  );
};

export default generateToken;
