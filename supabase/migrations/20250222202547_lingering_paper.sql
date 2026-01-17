/*
  # Fix storage policies for receipt uploads

  1. Changes
    - Simplify storage policies further
    - Make bucket public
    - Remove all path restrictions
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
DROP POLICY IF EXISTS "Enable upload for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable read access for all users" ON storage.objects;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON storage.objects;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON storage.objects;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create or update the receipts bucket with simplified configuration
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

-- Create maximally permissive policies for authenticated users
CREATE POLICY "Allow all operations for authenticated users"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'receipts')
WITH CHECK (bucket_id = 'receipts');

COMMIT;