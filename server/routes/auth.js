// Authentication Routes (ES6 Modules)
// Handles user registration, login, and JWT token management

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import { hashPassword, comparePassword, generateToken } from '../utils/auth.js';

const router = express.Router();

// POST /api/v1/auth/register - User registration
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role = 'patient' } = req.body;

    // Input validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        status: 'error',
        message: 'Email, password, first name, and last name are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid email address'
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUserQuery = 'SELECT id FROM users WHERE email = $1';
    const existingUser = await pool.query(existingUserQuery, [email]);

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'User with this email already exists'
      });
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Insert new user into database
    const insertUserQuery = `
      INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, first_name, last_name, role, created_at
    `;

    const newUser = await pool.query(insertUserQuery, [
      email,
      hashedPassword,
      firstName,
      lastName,
      phone,
      role
    ]);

    const user = newUser.rows[0];

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    // Return success response (don't send password hash)
    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          createdAt: user.created_at
        },
        token: token
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Registration failed. Please try again.'
    });
  }
});

// POST /api/v1/auth/login - User login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const userQuery = 'SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = $1';
    const userResult = await pool.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    const user = userResult.rows[0];

    // Check if user account is active
    if (!user.is_active) {
      return res.status(401).json({
        status: 'error',
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = generateToken(user.id, user.role);

    // Return success response (don't send password hash)
    res.status(200).json({
      status: 'success',
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        },
        token: token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Login failed. Please try again.'
    });
  }
});


export default router;
