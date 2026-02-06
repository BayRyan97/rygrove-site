-- Add 'Supervisor' role to the profiles table
ALTER TABLE profiles
ADD COLUMN role ENUM('admin', 'employee', 'supervisor') DEFAULT 'employee';

-- Update RLS policies for time_entries to allow supervisors to enter time for others
CREATE POLICY "Allow supervisors to insert time entries for others"
ON time_entries
FOR INSERT
USING (
  auth.role() = 'supervisor'
);

-- Update RLS policies for time_entries to allow supervisors to view others' time entries
CREATE POLICY "Allow supervisors to select time entries for others"
ON time_entries
FOR SELECT
USING (
  auth.role() = 'supervisor'
);

-- Ensure supervisors cannot access cost-related data
CREATE POLICY "Restrict supervisors from viewing cost data"
ON time_entries
FOR SELECT
USING (
  auth.role() != 'supervisor' OR cost IS NULL);

-- Ensure supervisors cannot access the admin dashboard
-- This will be enforced at the application level.