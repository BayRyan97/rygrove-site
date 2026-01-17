/*
  # Add is_full_day column to time_entries

  1. Changes
    - Add is_full_day boolean column to time_entries table with default value true
    - Update existing rows to have is_full_day = true
    - Add NOT NULL constraint to ensure data consistency

  2. Security
    - Update RLS policies to ensure proper access
*/

-- Add is_full_day column
ALTER TABLE time_entries 
ADD COLUMN is_full_day boolean DEFAULT true;

-- Update existing rows
UPDATE time_entries 
SET is_full_day = true 
WHERE is_full_day IS NULL;

-- Make is_full_day NOT NULL
ALTER TABLE time_entries 
ALTER COLUMN is_full_day SET NOT NULL;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow users to read own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can view own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can insert own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can update own time entries" ON time_entries;
DROP POLICY IF EXISTS "Admins can view all time entries" ON time_entries;

-- Create simplified policies
CREATE POLICY "Enable read access for users and admins"
ON time_entries FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Enable insert access for users"
ON time_entries FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Enable update access for users"
ON time_entries FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id_date 
ON time_entries(user_id, date);