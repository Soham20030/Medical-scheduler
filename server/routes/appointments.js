// Appointment Management Routes (ES6 Modules)
// Complete appointment scheduling, viewing, and management operations

import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/v1/appointments - Get user's appointments (patients see their bookings, doctors see their schedule)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let appointmentsQuery;
    let queryParams;

    if (userRole === 'patient') {
      // Patients see their own appointments
      appointmentsQuery = `
        SELECT a.id, a.appointment_date, a.start_time, a.end_time, a.status, a.notes,
               a.created_at, ms.name as specialty_name, ms.duration_minutes,
               u_doctor.first_name as doctor_first_name, u_doctor.last_name as doctor_last_name,
               u_doctor.email as doctor_email, d.consultation_fee
        FROM appointments a
        JOIN doctors d ON a.doctor_id = d.id
        JOIN users u_doctor ON d.user_id = u_doctor.id
        LEFT JOIN medical_specialties ms ON d.specialty_id = ms.id
        WHERE a.patient_id = $1
        ORDER BY a.appointment_date DESC, a.start_time DESC
      `;
      queryParams = [userId];
      
    } else if (userRole === 'doctor') {
      // Doctors see appointments scheduled with them
      appointmentsQuery = `
        SELECT a.id, a.appointment_date, a.start_time, a.end_time, a.status, a.notes,
               a.created_at, ms.name as specialty_name, ms.duration_minutes,
               u_patient.first_name as patient_first_name, u_patient.last_name as patient_last_name,
               u_patient.email as patient_email, u_patient.phone as patient_phone
        FROM appointments a
        JOIN users u_patient ON a.patient_id = u_patient.id
        JOIN doctors d ON a.doctor_id = d.id
        LEFT JOIN medical_specialties ms ON d.specialty_id = ms.id
        WHERE d.user_id = $1
        ORDER BY a.appointment_date ASC, a.start_time ASC
      `;
      queryParams = [userId];
      
    } else {
      // Admin sees all appointments
      appointmentsQuery = `
        SELECT a.id, a.appointment_date, a.start_time, a.end_time, a.status, a.notes,
               a.created_at, ms.name as specialty_name, ms.duration_minutes,
               u_patient.first_name as patient_first_name, u_patient.last_name as patient_last_name,
               u_doctor.first_name as doctor_first_name, u_doctor.last_name as doctor_last_name,
               d.consultation_fee
        FROM appointments a
        JOIN users u_patient ON a.patient_id = u_patient.id
        JOIN doctors d ON a.doctor_id = d.id
        JOIN users u_doctor ON d.user_id = u_doctor.id
        LEFT JOIN medical_specialties ms ON d.specialty_id = ms.id
        ORDER BY a.appointment_date DESC, a.start_time DESC
      `;
      queryParams = [];
    }

    const appointmentsResult = await pool.query(appointmentsQuery, queryParams);

    const appointments = appointmentsResult.rows.map(appointment => {
      let formattedAppointment = {
        id: appointment.id,
        appointmentDate: appointment.appointment_date,
        startTime: appointment.start_time,
        endTime: appointment.end_time,
        status: appointment.status,
        notes: appointment.notes,
        specialtyName: appointment.specialty_name,
        durationMinutes: appointment.duration_minutes,
        createdAt: appointment.created_at
      };

      // Add role-specific information
      if (userRole === 'patient') {
        formattedAppointment.doctor = {
          firstName: appointment.doctor_first_name,
          lastName: appointment.doctor_last_name,
          email: appointment.doctor_email
        };
        formattedAppointment.consultationFee = parseFloat(appointment.consultation_fee);
      } else if (userRole === 'doctor') {
        formattedAppointment.patient = {
          firstName: appointment.patient_first_name,
          lastName: appointment.patient_last_name,
          email: appointment.patient_email,
          phone: appointment.patient_phone
        };
      } else {
        // Admin sees both patient and doctor info
        formattedAppointment.patient = {
          firstName: appointment.patient_first_name,
          lastName: appointment.patient_last_name
        };
        formattedAppointment.doctor = {
          firstName: appointment.doctor_first_name,
          lastName: appointment.doctor_last_name
        };
        formattedAppointment.consultationFee = parseFloat(appointment.consultation_fee);
      }

      return formattedAppointment;
    });

    res.status(200).json({
      status: 'success',
      message: 'Appointments retrieved successfully',
      data: {
        appointments: appointments,
        count: appointments.length
      }
    });

  } catch (error) {
    console.error('Appointments fetch error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch appointments'
    });
  }
});

// POST /api/v1/appointments - Create new appointment (patients only)
router.post('/', authenticateToken, requireRole('patient'), async (req, res) => {
  try {
    const patientId = req.user.id;
    const { doctorId, appointmentDate, startTime, notes } = req.body;

    // Input validation
    if (!doctorId || !appointmentDate || !startTime) {
      return res.status(400).json({
        status: 'error',
        message: 'Doctor ID, appointment date, and start time are required'
      });
    }

    // Validate date format and ensure it's in the future
    const appointmentDateTime = new Date(`${appointmentDate}T${startTime}`);
    const currentDateTime = new Date();

    if (appointmentDateTime <= currentDateTime) {
      return res.status(400).json({
        status: 'error',
        message: 'Appointment must be scheduled for a future date and time'
      });
    }

    // Check if doctor exists and is available
    const doctorQuery = `
      SELECT d.id, d.user_id, d.is_available, d.specialty_id, d.consultation_fee,
             ms.duration_minutes, u.first_name, u.last_name
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN medical_specialties ms ON d.specialty_id = ms.id
      WHERE d.id = $1 AND u.is_active = true AND d.is_available = true
    `;

    const doctorResult = await pool.query(doctorQuery, [doctorId]);

    if (doctorResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Doctor not found or not available'
      });
    }

    const doctor = doctorResult.rows[0];
    const durationMinutes = doctor.duration_minutes || 30; // Default 30 minutes

    // Calculate end time based on appointment duration
    const endTime = new Date(appointmentDateTime.getTime() + (durationMinutes * 60000));
    const endTimeString = endTime.toTimeString().slice(0, 5); // Format: HH:MM

    // Check doctor's availability for the requested day and time
    const dayOfWeek = appointmentDateTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    const availabilityQuery = `
      SELECT start_time, end_time
      FROM time_slots
      WHERE doctor_id = $1 AND day_of_week = $2
    `;

    const availabilityResult = await pool.query(availabilityQuery, [doctorId, dayOfWeek]);

    if (availabilityResult.rows.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Doctor is not available on this day of the week'
      });
    }

    // Check if requested time falls within doctor's available hours
    const doctorAvailability = availabilityResult.rows[0];
    const requestedStartTime = startTime;
    const requestedEndTime = endTimeString;

    if (requestedStartTime < doctorAvailability.start_time || requestedEndTime > doctorAvailability.end_time) {
      return res.status(400).json({
        status: 'error',
        message: `Doctor is available from ${doctorAvailability.start_time} to ${doctorAvailability.end_time} on this day`
      });
    }

    // Check for conflicting appointments
    const conflictQuery = `
      SELECT id FROM appointments
      WHERE doctor_id = $1 
      AND appointment_date = $2
      AND status IN ('scheduled', 'confirmed')
      AND (
        (start_time <= $3 AND end_time > $3) OR
        (start_time < $4 AND end_time >= $4) OR
        (start_time >= $3 AND end_time <= $4)
      )
    `;

    const conflictResult = await pool.query(conflictQuery, [
      doctorId, 
      appointmentDate, 
      requestedStartTime, 
      requestedEndTime
    ]);

    if (conflictResult.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'This time slot is already booked. Please choose a different time.'
      });
    }

    // Create the appointment
    const appointmentId = uuidv4();
    
    const insertAppointmentQuery = `
      INSERT INTO appointments (id, patient_id, doctor_id, appointment_date, start_time, end_time, status, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, appointment_date, start_time, end_time, status, notes, created_at
    `;

    const newAppointment = await pool.query(insertAppointmentQuery, [
      appointmentId,
      patientId,
      doctorId,
      appointmentDate,
      requestedStartTime,
      requestedEndTime,
      'scheduled',
      notes || null
    ]);

    const appointment = newAppointment.rows[0];

    // Return success response with appointment details
    res.status(201).json({
      status: 'success',
      message: 'Appointment scheduled successfully',
      data: {
        appointment: {
          id: appointment.id,
          appointmentDate: appointment.appointment_date,
          startTime: appointment.start_time,
          endTime: appointment.end_time,
          status: appointment.status,
          notes: appointment.notes,
          createdAt: appointment.created_at,
          doctor: {
            firstName: doctor.first_name,
            lastName: doctor.last_name,
            consultationFee: parseFloat(doctor.consultation_fee)
          },
          durationMinutes: durationMinutes
        }
      }
    });

  } catch (error) {
    console.error('Appointment creation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create appointment. Please try again.'
    });
  }
});

// PUT /api/v1/appointments/:id - Update appointment (reschedule or modify)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { appointmentDate, startTime, notes, status } = req.body;

    // Get existing appointment details
    const existingAppointmentQuery = `
      SELECT a.*, d.user_id as doctor_user_id, d.specialty_id,
             ms.duration_minutes, u_patient.first_name as patient_name,
             u_doctor.first_name as doctor_name
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users u_patient ON a.patient_id = u_patient.id
      JOIN users u_doctor ON d.user_id = u_doctor.id
      LEFT JOIN medical_specialties ms ON d.specialty_id = ms.id
      WHERE a.id = $1
    `;

    const existingResult = await pool.query(existingAppointmentQuery, [appointmentId]);

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Appointment not found'
      });
    }

    const existingAppointment = existingResult.rows[0];

    // Check permissions: patients can only modify their own appointments, doctors can modify appointments scheduled with them
    if (userRole === 'patient' && existingAppointment.patient_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only modify your own appointments'
      });
    }

    if (userRole === 'doctor' && existingAppointment.doctor_user_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only modify appointments scheduled with you'
      });
    }

    // Build update query dynamically based on provided fields
    let updateFields = [];
    let queryParams = [];
    let paramCount = 1;

    if (appointmentDate) {
      updateFields.push(`appointment_date = $${paramCount}`);
      queryParams.push(appointmentDate);
      paramCount++;
    }

    if (startTime) {
      updateFields.push(`start_time = $${paramCount}`);
      queryParams.push(startTime);
      paramCount++;

      // Calculate new end time if start time is being updated
      const durationMinutes = existingAppointment.duration_minutes || 30;
      const newStartDateTime = new Date(`${appointmentDate || existingAppointment.appointment_date}T${startTime}`);
      const newEndDateTime = new Date(newStartDateTime.getTime() + (durationMinutes * 60000));
      const newEndTime = newEndDateTime.toTimeString().slice(0, 5);

      updateFields.push(`end_time = $${paramCount}`);
      queryParams.push(newEndTime);
      paramCount++;
    }

    if (notes !== undefined) {
      updateFields.push(`notes = $${paramCount}`);
      queryParams.push(notes);
      paramCount++;
    }

    // Only doctors and admins can update appointment status
    if (status && (userRole === 'doctor' || userRole === 'admin')) {
      const validStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'];
      if (validStatuses.includes(status)) {
        updateFields.push(`status = $${paramCount}`);
        queryParams.push(status);
        paramCount++;
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No valid fields provided for update'
      });
    }

    // Add updated_at timestamp and appointment ID
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    queryParams.push(appointmentId);

    const updateQuery = `
      UPDATE appointments 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, appointment_date, start_time, end_time, status, notes, updated_at
    `;

    const updateResult = await pool.query(updateQuery, queryParams);
    const updatedAppointment = updateResult.rows[0];

    res.status(200).json({
      status: 'success',
      message: 'Appointment updated successfully',
      data: {
        appointment: {
          id: updatedAppointment.id,
          appointmentDate: updatedAppointment.appointment_date,
          startTime: updatedAppointment.start_time,
          endTime: updatedAppointment.end_time,
          status: updatedAppointment.status,
          notes: updatedAppointment.notes,
          updatedAt: updatedAppointment.updated_at
        }
      }
    });

  } catch (error) {
    console.error('Appointment update error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update appointment'
    });
  }
});

// DELETE /api/v1/appointments/:id - Cancel appointment
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get appointment details to check permissions
    const appointmentQuery = `
      SELECT a.patient_id, a.status, a.appointment_date, a.start_time,
             d.user_id as doctor_user_id, u_patient.first_name as patient_name,
             u_doctor.first_name as doctor_name
      FROM appointments a
      JOIN doctors d ON a.doctor_id = d.id
      JOIN users u_patient ON a.patient_id = u_patient.id
      JOIN users u_doctor ON d.user_id = u_doctor.id
      WHERE a.id = $1
    `;

    const appointmentResult = await pool.query(appointmentQuery, [appointmentId]);

    if (appointmentResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Appointment not found'
      });
    }

    const appointment = appointmentResult.rows[0];

    // Check permissions
    if (userRole === 'patient' && appointment.patient_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only cancel your own appointments'
      });
    }

    if (userRole === 'doctor' && appointment.doctor_user_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: 'You can only cancel appointments scheduled with you'
      });
    }

    // Check if appointment can be cancelled
    if (appointment.status === 'cancelled') {
      return res.status(400).json({
        status: 'error',
        message: 'Appointment is already cancelled'
      });
    }

    if (appointment.status === 'completed') {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot cancel a completed appointment'
      });
    }

    // Update appointment status to cancelled instead of deleting
    const cancelQuery = `
      UPDATE appointments 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, status, updated_at
    `;

    const cancelResult = await pool.query(cancelQuery, [appointmentId]);
    const cancelledAppointment = cancelResult.rows[0];

    res.status(200).json({
      status: 'success',
      message: 'Appointment cancelled successfully',
      data: {
        appointment: {
          id: cancelledAppointment.id,
          status: cancelledAppointment.status,
          cancelledAt: cancelledAppointment.updated_at
        }
      }
    });

  } catch (error) {
    console.error('Appointment cancellation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to cancel appointment'
    });
  }
});

export default router;

