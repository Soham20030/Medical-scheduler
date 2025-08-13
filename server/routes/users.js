// User Management Routes (ES6 Modules) 
// Protected routes for user profile operations and doctor listings

import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/v1/users/profile - Get authenticated user's profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // User data is already available from authenticateToken middleware
    const user = req.user;

    // Get additional profile data based on user role
    let profileData = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    };

    // If user is a doctor, get their doctor-specific information
    if (user.role === 'doctor') {
      const doctorQuery = `
        SELECT d.license_number, d.years_experience, d.consultation_fee, 
               d.is_available, ms.name as specialty_name
        FROM doctors d
        LEFT JOIN medical_specialties ms ON d.specialty_id = ms.id
        WHERE d.user_id = $1
      `;
      const doctorResult = await pool.query(doctorQuery, [user.id]);
      
      if (doctorResult.rows.length > 0) {
        const doctorInfo = doctorResult.rows[0];
        profileData.doctorInfo = {
          licenseNumber: doctorInfo.license_number,
          yearsExperience: doctorInfo.years_experience,
          consultationFee: doctorInfo.consultation_fee,
          isAvailable: doctorInfo.is_available,
          specialtyName: doctorInfo.specialty_name
        };
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Profile retrieved successfully',
      data: {
        user: profileData
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user profile'
    });
  }
});

// GET /api/v1/users/doctors - Get all available doctors (protected route)
router.get('/doctors', authenticateToken, async (req, res) => {
  try {
    const doctorsQuery = `
      SELECT u.id, u.first_name, u.last_name, u.email,
             d.license_number, d.years_experience, d.consultation_fee, d.is_available,
             ms.name as specialty_name, ms.duration_minutes
      FROM users u
      JOIN doctors d ON u.id = d.user_id
      LEFT JOIN medical_specialties ms ON d.specialty_id = ms.id
      WHERE u.role = 'doctor' AND u.is_active = true AND d.is_available = true
      ORDER BY u.last_name, u.first_name
    `;

    const doctorsResult = await pool.query(doctorsQuery);

    const doctors = doctorsResult.rows.map(doctor => ({
      id: doctor.id,
      firstName: doctor.first_name,
      lastName: doctor.last_name,
      email: doctor.email,
      licenseNumber: doctor.license_number,
      yearsExperience: doctor.years_experience,
      consultationFee: parseFloat(doctor.consultation_fee),
      specialtyName: doctor.specialty_name,
      durationMinutes: doctor.duration_minutes,
      isAvailable: doctor.is_available
    }));

    res.status(200).json({
      status: 'success',
      message: 'Doctors retrieved successfully',
      data: {
        doctors: doctors,
        count: doctors.length
      }
    });

  } catch (error) {
    console.error('Doctors fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch doctors'
    });
  }
});

// PUT /api/v1/users/profile - Update authenticated user's profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!firstName || !lastName) {
      return res.status(400).json({
        status: 'error',
        message: 'First name and last name are required'
      });
    }

    // Update user profile
    const updateQuery = `
      UPDATE users 
      SET first_name = $1, last_name = $2, phone = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING first_name, last_name, phone, updated_at
    `;

    const updateResult = await pool.query(updateQuery, [firstName, lastName, phone, userId]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const updatedUser = updateResult.rows[0];

    res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: {
        user: {
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          phone: updatedUser.phone,
          updatedAt: updatedUser.updated_at
        }
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update profile'
    });
  }
});

// GET /api/v1/users/admin/all - Get all users (admin only)
router.get('/admin/all', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const usersQuery = `
      SELECT id, email, first_name, last_name, role, is_active, created_at
      FROM users
      ORDER BY created_at DESC
    `;

    const usersResult = await pool.query(usersQuery);

    const users = usersResult.rows.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at
    }));

    res.status(200).json({
      status: 'success',
      message: 'All users retrieved successfully',
      data: {
        users: users,
        count: users.length
      }
    });

  } catch (error) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch users'
    });
  }
});

export default router;
