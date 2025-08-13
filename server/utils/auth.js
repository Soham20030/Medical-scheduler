// Handles password hashing, JWT token generation and verification

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Password hashing utilities
export const hashPassword = async (password) => {
  try {
    const saltRounds = 12; // Higher number = more secure but slower
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  } catch (error) {
    throw new Error('Password hashing failed');
  }
};

export const comparePassword = async (plainPassword, hashedPassword) => {
  try {
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    return isMatch;
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// JWT token utilities
export const generateToken = (userId, role) => {
  try {
    const payload = {
      userId: userId,
      role: role,
      iat: Math.floor(Date.now() / 1000) // Issued at time
    };
    
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
    
    return token;
  } catch (error) {
    throw new Error('Token generation failed');
  }
};

export const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Token verification failed');
  }
};
