// JWT Authentication Middleware (ES6 Modules)
// Protects routes and provides role-based access control

import { verifyToken } from '../utils/auth.js';
import pool from '../config/database.js';

// Middleware to verify JWT token and authenticate user
export const authenticateToken = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Access token is required'
      });
    }

    // Verify the JWT token
    const decoded = verifyToken(token);

    // Get user details from database to ensure user still exists and is active
    const userQuery = 'SELECT id, email, first_name, last_name, role, is_active FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [decoded.userId]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    // Check if user account is still active
    if (!user.is_active) {
      return res.status(401).json({
        status: 'error',
        message: 'Account is deactivated'
      });
    }

    // Add user information to request object for use in route handlers
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role
    };

    next(); // Continue to the protected route

  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(403).json({
      status: 'error',
      message: 'Invalid or expired token'
    });
  }
};

// Middleware to check user roles (role-based access control)
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      // Check if user has been authenticated (authenticateToken should run first)
      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'Authentication required'
        });
      }

      // Check if user's role is in the allowed roles
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          status: 'error',
          message: 'Insufficient permissions for this action'
        });
      }

      next(); // User has the required role, continue

    } catch (error) {
      console.error('Role verification error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Authorization check failed'
      });
    }
  };
};
