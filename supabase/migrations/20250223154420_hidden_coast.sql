-- Start transaction
BEGIN;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON storage.objects;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create or update the receipts bucket with proper configuration
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

-- Create separate policies for different operations
CREATE POLICY "Allow upload for authenticated users"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts' AND
  CASE 
    WHEN auth.role() = 'authenticated' THEN true
    ELSE false
  END
);

CREATE POLICY "Allow read for authenticated users"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' AND
  CASE 
    WHEN auth.role() = 'authenticated' THEN true
    ELSE false
  END
);

CREATE POLICY "Allow update for authenticated users"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'receipts' AND
  CASE 
    WHEN auth.role() = 'authenticated' THEN true
    ELSE false
  END
);

CREATE POLICY "Allow delete for authenticated users"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts' AND
  CASE 
    WHEN auth.role() = 'authenticated' THEN true
    ELSE false
  END
);

COMMIT;