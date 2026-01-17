/*
  # Add email column to profiles table

  1. Changes
    - Add email column to profiles table
      - email (text)
      - Make email nullable since some profiles may not have an email
      - Add index on email for faster lookups

  2. Security
    - No changes to RLS policies needed as existing policies cover the new column
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text;
    CREATE INDEX idx_profiles_email ON profiles(email);
  END IF;
END $$;