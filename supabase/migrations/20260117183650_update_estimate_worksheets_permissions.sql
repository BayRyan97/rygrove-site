/*
  # Update Estimate Worksheets Permissions
  
  Updates RLS policies for estimate_worksheets to support admin privileges.
  
  1. Changes
    - Drop existing RLS policies
    - Add new policies that allow admins to manage all estimates
    - Allow non-admins to only manage estimates they created (user_id = auth.uid())
  
  2. Security
    - Admins (role = 'admin' in profiles table) can view, create, update, and delete any estimate
    - Non-admins can only view, create, update, and delete their own estimates
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own estimates" ON estimate_worksheets;
DROP POLICY IF EXISTS "Users can create own estimates" ON estimate_worksheets;
DROP POLICY IF EXISTS "Users can update own estimates" ON estimate_worksheets;
DROP POLICY IF EXISTS "Users can delete own estimates" ON estimate_worksheets;

-- Create new policies with admin support
CREATE POLICY "Users can view estimates"
  ON estimate_worksheets FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Users can create estimates"
  ON estimate_worksheets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update estimates"
  ON estimate_worksheets FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  )
  WITH CHECK (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "Users can delete estimates"
  ON estimate_worksheets FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );