/*
  # Add email column to profiles table

  1. Changes
    - Add email column to profiles table
    - Update handle_new_user function to store email

  2. Notes
    - Email column is added as TEXT type
    - handle_new_user function is updated to store email from auth.users
*/

-- Add email column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Update handle_new_user function to include email
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;