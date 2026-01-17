/*
  # Fix storage policies for receipt uploads

  1. Changes
    - Simplify storage policies
    - Make bucket public
    - Remove path restrictions
    - Enable basic RLS
  
  2. Security
    - Allow authenticated users to upload files
    - Allow public access to files
    - Set size limits
    - Restrict file types
*/

-- Start transaction
BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow users to upload own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to update own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to delete own receipts" ON storage.objects;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

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
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create simple policies for storage
CREATE POLICY "Enable upload for authenticated users"
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Enable read access for all users"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

CREATE POLICY "Enable update for authenticated users"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts');

CREATE POLICY "Enable delete for authenticated users"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');

COMMIT;