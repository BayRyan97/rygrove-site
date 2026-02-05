-- Add rate column to profiles table
-- This represents the hourly rate in dollars for each user
-- Only admins can update this field via RLS policy

-- Add rate column with default value of 0
ALTER TABLE profiles 
ADD COLUMN rate NUMERIC(8,2) DEFAULT 0;

-- Update RLS policies to restrict rate updates to admins only
-- Drop existing update policy if it exists
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Recreate update policy with rate restrictions
CREATE POLICY "Users can update own profile" ON profiles
FOR UPDATE
USING (
  auth.uid() = id
)
WITH CHECK (
  -- Users can only update their own profile
  auth.uid() = id
  AND
  -- Users cannot update the rate field (it will be ignored)
  -- Admins can update rate via the admin-specific policy
  (
    rate IS NULL 
    OR rate = (SELECT rate FROM profiles WHERE id = auth.uid())
  )
);

-- Create a separate policy for admins to update any profile including rate
CREATE POLICY "Admins can update any profile" ON profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);
