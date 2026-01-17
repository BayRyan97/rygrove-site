/*
  # Add storage policies for receipt uploads

  1. Changes
    - Enable storage for authenticated users
    - Add policies for the receipts bucket:
      - Allow authenticated users to upload their own receipts
      - Allow users to read their own receipts
      - Allow admins to read all receipts
  
  2. Security
    - Enforce user-specific paths for uploads
    - Restrict file types to images
    - Limit file sizes
*/

-- Create storage policies for the receipts bucket
BEGIN;

-- Enable storage by default for authenticated users
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

-- Policy to allow users to upload their own receipts
CREATE POLICY "Users can upload their own receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy to allow users to read their own receipts
CREATE POLICY "Users can read their own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' AND
  (
    -- Allow users to read their own receipts
    (storage.foldername(name))[1] = auth.uid()::text
    OR
    -- Allow admins to read all receipts
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
);

COMMIT;