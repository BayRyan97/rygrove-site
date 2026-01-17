/*
  # Add admin policies for time entries

  1. Changes
    - Update time entries policies to allow admins to manage entries for all users
    - Update expenses policies to allow admins to manage expenses for all users
    - Add indexes for improved query performance

  2. Security
    - Maintain existing user policies
    - Add new admin-specific policies for broader access
    - Ensure proper role-based access control
*/

-- Add indexes for improved performance
CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Update time entries policies for admin access
DROP POLICY IF EXISTS "Users can view own entries and admins can view all" ON time_entries;
DROP POLICY IF EXISTS "Users can insert own entries and admins can insert for any" ON time_entries;
DROP POLICY IF EXISTS "Users can update own entries and admins can update all" ON time_entries;

CREATE POLICY "Enable read access for users to own time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

CREATE POLICY "Enable insert access for users to own time entries"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "Enable update access for users to own time entries"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- Add separate policies for admin access to time entries
CREATE POLICY "Enable admin read access to all time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Enable admin insert access to all time entries"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Enable admin update access to all time entries"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Update expenses policies for admin access
DROP POLICY IF EXISTS "Users can view own expenses and admins can view all" ON expenses;
DROP POLICY IF EXISTS "Users can insert own expenses and admins can insert for any" ON expenses;
DROP POLICY IF EXISTS "Users can update own expenses and admins can update all" ON expenses;

CREATE POLICY "Enable read access for users to own expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

CREATE POLICY "Enable insert access for users to own expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "Enable update access for users to own expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
  );

-- Add separate policies for admin access to expenses
CREATE POLICY "Enable admin read access to all expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Enable admin insert access to all expenses"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Enable admin update access to all expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );