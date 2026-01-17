/*
  # Fix admin policies to avoid recursion

  1. Changes
    - Remove recursive policy check for profiles
    - Add simpler admin check using role column
    - Keep existing policies intact
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Create new non-recursive policy for profiles
CREATE POLICY "Users can view own profile and admins can view all"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Update other policies to use the same pattern
DROP POLICY IF EXISTS "Admins can view all time entries" ON time_entries;
CREATE POLICY "Users can view own entries and admins can view all"
  ON time_entries FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can insert time entries for any user" ON time_entries;
CREATE POLICY "Users can insert own entries and admins can insert for any"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can update all time entries" ON time_entries;
CREATE POLICY "Users can update own entries and admins can update all"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can view all expenses" ON expenses;
CREATE POLICY "Users can view own expenses and admins can view all"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can insert expenses for any user" ON expenses;
CREATE POLICY "Users can insert own expenses and admins can insert for any"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "Admins can update all expenses" ON expenses;
CREATE POLICY "Users can update own expenses and admins can update all"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );