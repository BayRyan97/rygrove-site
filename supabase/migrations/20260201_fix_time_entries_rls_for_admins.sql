/*
  # Fix time_entries RLS policies for admin access
  
  Drop all existing SELECT policies on time_entries and create one unified policy
  that allows:
  - Users to see their own entries (user_id = auth.uid())
  - Admins to see ALL entries (role = 'admin' in profiles table)
*/

-- Drop all existing SELECT policies on time_entries
DROP POLICY IF EXISTS "Users can view their own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can view own entries and admins can view all" ON time_entries;
DROP POLICY IF EXISTS "Enable admin read access to all time entries" ON time_entries;
DROP POLICY IF EXISTS "Admins can view all time entries" ON time_entries;
DROP POLICY IF EXISTS "Allow time entry access" ON time_entries;

-- Create single unified SELECT policy
CREATE POLICY "time_entries_select_policy"
  ON time_entries
  FOR SELECT
  TO authenticated
  USING (
    -- Users can see their own entries
    user_id = auth.uid()
    OR
    -- Admins can see all entries
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
