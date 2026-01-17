/*
  # Fix Storage Policies and Time Entry Permissions

  1. Changes
    - Simplify storage policies for better reliability
    - Ensure storage bucket exists with correct settings
    - Update time entry policies for better access control

  2. Security
    - Maintain proper authentication checks
    - Ensure secure file access
*/

-- Start transaction
BEGIN;

-- Drop existing storage policies
DROP POLICY IF EXISTS "Allow upload for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Allow read for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete for authenticated users" ON storage.objects;

-- Create or update the receipts bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/heif'];

-- Create simplified storage policies
CREATE POLICY "Enable storage access for authenticated users"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

-- Update time entries policies
DROP POLICY IF EXISTS "Enable read access for users and admins" ON time_entries;
DROP POLICY IF EXISTS "Enable insert access for users" ON time_entries;
DROP POLICY IF EXISTS "Enable update access for users" ON time_entries;

-- Create new time entries policies
CREATE POLICY "Allow time entry access"
ON time_entries
FOR ALL
TO authenticated
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

COMMIT;