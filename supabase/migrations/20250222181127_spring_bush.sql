/*
  # Fix RLS policies for admin access

  1. Changes
    - Simplify and fix RLS policies to properly handle admin access
    - Ensure admins can view all time entries and related data
    - Fix join conditions for proper data access

  2. Security
    - Maintain user data privacy while allowing admin access
    - Ensure proper cascading of permissions through related tables
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own entries and admins can view all entries" ON time_entries;
DROP POLICY IF EXISTS "Users can view own expenses and admins can view all expenses" ON expenses;
DROP POLICY IF EXISTS "Users can view own profile and admins can view all profiles" ON profiles;

-- Create new simplified policies for time entries
CREATE POLICY "View time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Create new simplified policies for expenses
CREATE POLICY "View expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Create new simplified policies for profiles
CREATE POLICY "View profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR 
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Add index to improve policy performance
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON profiles(role, id);