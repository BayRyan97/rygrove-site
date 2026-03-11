/*
  # Fix admin profile picture policies

  1. Problem
     - Admins could not upload profile pictures for other users because:
       a) profiles UPDATE RLS only allows id = auth.uid() (no admin override)
       b) Storage avatars policies only allow uploading to the authenticated
          user's own folder, blocking admins from writing to another user's folder

  2. Changes
     - Add admin UPDATE access to profiles table
     - Update avatars storage INSERT / UPDATE / DELETE policies to also allow admins
*/

-- ─── Profiles table ───────────────────────────────────────────────────────────

-- Drop the restrictive update policy and recreate with admin exception
DROP POLICY IF EXISTS "Enable update access for users to own profile" ON profiles;

CREATE POLICY "Enable update access for users to own profile or admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    id = auth.uid()
    OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- ─── Storage: avatars bucket ──────────────────────────────────────────────────

-- INSERT
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;

CREATE POLICY "Users can upload their own avatar or admins can upload any"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );

-- UPDATE
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;

CREATE POLICY "Users can update their own avatar or admins can update any"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );

-- DELETE
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

CREATE POLICY "Users can delete their own avatar or admins can delete any"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    )
  );
