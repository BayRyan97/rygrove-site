/*
  # Add admin role to Bailey Ryan

  1. Changes
    - Update Bailey Ryan's role to 'admin' in profiles table
    - Add policies for admin access to view and manage all users' data

  2. Security
    - Add policies allowing admins to view and manage all time entries and expenses
    - Regular users can still only access their own data
*/

-- Update Bailey Ryan's role to admin
UPDATE profiles 
SET role = 'admin'
WHERE full_name = 'Bailey Ryan';

-- Add admin policies for time entries
CREATE POLICY "Admins can view all time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert time entries for any user"
  ON time_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all time entries"
  ON time_entries FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add admin policies for expenses
CREATE POLICY "Admins can view all expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert expenses for any user"
  ON expenses FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all expenses"
  ON expenses FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add admin policies for profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );