// Database Connection Configuration (ES6 Modules)
// PostgreSQL connection setup using pg library

import pkg from 'pg';
import dotenv from 'dotenv';

// Configure environment variables
dotenv.config();

// Extract Pool from pg package (needed for ES6 import)
const { Pool } = pkg;

// Create PostgreSQL connection pool
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Connection pool settings for performance
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection cannot be established
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
  process.exit(-1);
});

// ES6 default export
export default pool;
