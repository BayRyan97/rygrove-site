-- Storage Setup Guide for Profile Pictures

-- 1. CREATE STORAGE BUCKET (Run in Supabase Dashboard or CLI)
-- Go to Supabase Dashboard > Storage > Buckets
-- Click "New Bucket"
-- Name: avatars
-- Public: YES (to allow public read access)
-- Or run via CLI: supabase storage create-bucket avatars --public

-- 2. RLS POLICIES FOR AVATARS BUCKET

-- Policy: Allow users to upload to their own folder
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Allow users to update their own avatar
CREATE POLICY "Users can update their own avatar"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Allow users to delete their own avatar
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy: Allow public read access to avatar images
CREATE POLICY "Public read access to avatars"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- 3. NOTES

-- The storage policies above allow:
-- - Each authenticated user to upload, update, and delete files in their own folder: avatars/{user_id}/{timestamp}-{filename}
-- - Anyone (public) to read/download avatar images
-- - File size is limited by Supabase limits (default 5GB per upload)

-- For the app, file size is enforced client-side at 5MB (see ProfilePictureUploader.tsx)

-- 4. Verify Setup

-- After creating the bucket and policies:
-- 1. Go to Supabase Dashboard > Storage > avatars
-- 2. Click on "Policies" tab
-- 3. Verify the 4 policies above are listed (insert, update, delete, select)
-- 4. Test uploading a picture from the app

-- 5. Troubleshooting

-- If uploads fail with "permission denied":
-- - Check that avatars bucket exists and is marked as Public
-- - Verify RLS policies are enabled for storage
-- - Check that user is authenticated
-- - Review Supabase logs for detailed error messages

-- If pictures don't appear:
-- - Verify profile_picture_url is correctly set in profiles table
-- - Check that picture_metadata JSON is properly formatted
-- - Ensure CSS transform styles are applied (see Dashboard.tsx and AdminPage.tsx)
