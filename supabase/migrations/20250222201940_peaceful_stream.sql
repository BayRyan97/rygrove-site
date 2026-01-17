/*
  # Fix storage policies for receipt uploads

  1. Changes
    - Drop existing policies to ensure clean state
    - Create bucket with proper configuration
    - Add comprehensive storage policies
    - Enable RLS for storage
  
  2. Security
    - Enforce user-specific paths
    - Restrict file types
    - Set size limits
*/

-- Start transaction
BEGIN;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own receipts" ON storage.objects;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create or update the receipts bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  false, -- Set to false for better security
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
SET 
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create policy for uploading receipts
CREATE POLICY "Allow users to upload own receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts' AND
  (auth.uid())::text = (storage.foldername(name))[1]
);

-- Create policy for reading receipts
CREATE POLICY "Allow users to read own receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' AND
  (
    (auth.uid())::text = (storage.foldername(name))[1] OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
);

-- Create policy for updating receipts
CREATE POLICY "Allow users to update own receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'receipts' AND
  (auth.uid())::text = (storage.foldername(name))[1]
);

-- Create policy for deleting receipts
CREATE POLICY "Allow users to delete own receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts' AND
  (auth.uid())::text = (storage.foldername(name))[1]
);

COMMIT;