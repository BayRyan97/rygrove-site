/*
  # Fix User Profile Data Structure

  1. Changes
    - Add NOT NULL constraint to full_name in profiles table
    - Add trigger to ensure full_name is always set
    - Add index on full_name for better query performance
    - Update existing NULL full_names with 'Unknown User'

  2. Security
    - No changes to existing RLS policies
*/

-- Update any NULL full_names to 'Unknown User'
UPDATE profiles 
SET full_name = 'Unknown User'
WHERE full_name IS NULL;

-- Add NOT NULL constraint to full_name
ALTER TABLE profiles 
ALTER COLUMN full_name SET NOT NULL;

-- Add index on full_name for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON profiles(full_name);

-- Create or replace the handle_new_user function to ensure full_name is always set
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Unknown User'),
    'employee'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;