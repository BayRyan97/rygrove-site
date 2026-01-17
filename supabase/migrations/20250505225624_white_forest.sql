/*
  # Add email column to profiles table

  1. Changes
    - Add email column to profiles table
      - email (text)
      - Make email nullable since some profiles may not have an email
      - Add index on email for faster lookups
    - Drop duplicate migration to prevent conflicts

  2. Security
    - No changes to RLS policies needed as existing policies cover the new column
*/

-- First drop the duplicate migration
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Add email column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text;
    CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
  END IF;
END $$;

-- Recreate the handle_new_user function with email support
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();