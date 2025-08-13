-- Medical Appointment Scheduler Seed Data
-- Development and testing data

-- Insert medical specialties
INSERT INTO medical_specialties (name, description, duration_minutes) VALUES
('General Medicine', 'General health checkups and consultations', 30),
('Cardiology', 'Heart and cardiovascular system specialists', 45),
('Dermatology', 'Skin, hair, and nail conditions', 30),
('Orthopedics', 'Bone, joint, and muscle disorders', 45),
('Pediatrics', 'Medical care for children and infants', 30);

-- Insert sample users (patients and doctors)
INSERT INTO users (email, password_hash, first_name, last_name, phone, role) VALUES
-- Patients
('john.doe@email.com', '$2b$10$dummy.hash.for.development', 'John', 'Doe', '+1234567890', 'patient'),
('jane.smith@email.com', '$2b$10$dummy.hash.for.development', 'Jane', 'Smith', '+1234567891', 'patient'),
('mike.wilson@email.com', '$2b$10$dummy.hash.for.development', 'Mike', 'Wilson', '+1234567892', 'patient'),
-- Doctors
('dr.sarah.johnson@hospital.com', '$2b$10$dummy.hash.for.development', 'Sarah', 'Johnson', '+1234567893', 'doctor'),
('dr.david.brown@hospital.com', '$2b$10$dummy.hash.for.development', 'David', 'Brown', '+1234567894', 'doctor'),
-- Admin
('admin@hospital.com', '$2b$10$dummy.hash.for.development', 'Admin', 'User', '+1234567895', 'admin');


-- Insert doctors (linking users to specialties)
INSERT INTO doctors (user_id, specialty_id, license_number, years_experience, consultation_fee) VALUES
-- Dr. Sarah Johnson - General Medicine
((SELECT id FROM users WHERE email = 'dr.sarah.johnson@hospital.com'), 
 (SELECT id FROM medical_specialties WHERE name = 'General Medicine'), 
 'MD123456', 8, 150.00),
-- Dr. David Brown - Cardiology  
((SELECT id FROM users WHERE email = 'dr.david.brown@hospital.com'), 
 (SELECT id FROM medical_specialties WHERE name = 'Cardiology'), 
 'MD789012', 12, 250.00);

-- Insert time slots (doctor availability)
INSERT INTO time_slots (doctor_id, day_of_week, start_time, end_time) VALUES
-- Dr. Sarah Johnson availability (Monday to Friday, 9 AM to 5 PM)
((SELECT id FROM doctors WHERE license_number = 'MD123456'), 1, '09:00', '17:00'), -- Monday
((SELECT id FROM doctors WHERE license_number = 'MD123456'), 2, '09:00', '17:00'), -- Tuesday
((SELECT id FROM doctors WHERE license_number = 'MD123456'), 3, '09:00', '17:00'), -- Wednesday
((SELECT id FROM doctors WHERE license_number = 'MD123456'), 4, '09:00', '17:00'), -- Thursday
((SELECT id FROM doctors WHERE license_number = 'MD123456'), 5, '09:00', '17:00'), -- Friday
-- Dr. David Brown availability (Monday, Wednesday, Friday, 10 AM to 4 PM)
((SELECT id FROM doctors WHERE license_number = 'MD789012'), 1, '10:00', '16:00'), -- Monday
((SELECT id FROM doctors WHERE license_number = 'MD789012'), 3, '10:00', '16:00'), -- Wednesday
((SELECT id FROM doctors WHERE license_number = 'MD789012'), 5, '10:00', '16:00'); -- Friday
