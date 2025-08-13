// Medical Appointment Scheduler - Main Server
// Entry point for Express.js backend API (ES6 Modules)

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

// Configure environment variables
dotenv.config();

// Import route handlers (we'll create these next)
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import appointmentRoutes from './routes/appointments.js';

// Initialize Express application
const app = express();
const PORT = process.env.PORT || 5000;

// Security and utility middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable cross-origin requests
app.use(morgan('combined')); // HTTP request logging
app.use(express.json()); // Parse JSON request bodies

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/appointments', appointmentRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Medical Scheduler API is running',
    timestamp: new Date().toISOString()
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error occurred:', err.stack);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Medical Scheduler API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
