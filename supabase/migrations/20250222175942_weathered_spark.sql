/*
  # Update RLS policies for admin view

  1. Changes
    - Update time entries policies to allow admins to view all entries
    - Update expenses policies to allow admins to view all entries
    - Update profiles policies to allow admins to view all profiles

  2. Security
    - Maintains existing user access restrictions
    - Adds admin access to view all data
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Enable read access for users to own time entries" ON time_entries;
DROP POLICY IF EXISTS "Enable admin read access to all time entries" ON time_entries;

-- Create new combined policy for time entries
CREATE POLICY "Users can view own entries and admins can view all entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Drop existing policies for expenses
DROP POLICY IF EXISTS "Enable read access for users to own expenses" ON expenses;
DROP POLICY IF EXISTS "Enable admin read access to all expenses" ON expenses;

-- Create new combined policy for expenses
CREATE POLICY "Users can view own expenses and admins can view all expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Drop existing policies for profiles
DROP POLICY IF EXISTS "Enable read access for users to own profile" ON profiles;
DROP POLICY IF EXISTS "Enable admin read access to all profiles" ON profiles;

-- Create new combined policy for profiles
CREATE POLICY "Users can view own profile and admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );