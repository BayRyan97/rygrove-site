-- Storage Setup Guide for Receipt Images

-- 1. CREATE STORAGE BUCKET (Run in Supabase Dashboard or CLI)
-- Go to Supabase Dashboard > Storage > Buckets
-- Click "New Bucket"
-- Name: receipts
-- Public: YES (to allow public read access to receipt images)
-- Or run via CLI: supabase storage create-bucket receipts --public

-- 2. RLS POLICIES FOR RECEIPTS BUCKET

-- Policy: Allow authenticated users to upload receipts to their own folder
CREATE POLICY "Users can upload their own receipts"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Allow users to update their own receipts
CREATE POLICY "Users can update their own receipts"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Allow users to delete their own receipts
CREATE POLICY "Users can delete their own receipts"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Allow public read access to receipt images
CREATE POLICY "Public read access to receipts"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'receipts');

-- 3. VERIFY SETUP
-- After running these policies, verify:
-- 1. Bucket 'receipts' exists and is marked as PUBLIC
-- 2. All 4 policies are active in Supabase Dashboard > Storage > Policies
-- 3. Test uploading a receipt from the Expense Manager page
-- 4. Test viewing the receipt by clicking the "View Receipt" link
