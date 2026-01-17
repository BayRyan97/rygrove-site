/*
  # Fix Infinite Recursion in Policies

  1. Changes
    - Simplify policies to completely avoid recursion
    - Use materialized role check for admin access
    - Remove all nested queries in policies

  2. Security
    - Maintain same security model
    - Improve performance with simpler policies
*/

-- First, create a function to check admin status that avoids recursion
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Drop all existing policies
DO $$ 
BEGIN
  -- Drop time entries policies
  DROP POLICY IF EXISTS "Users can view own time entries" ON time_entries;
  DROP POLICY IF EXISTS "Admins can view all time entries" ON time_entries;
  
  -- Drop expenses policies
  DROP POLICY IF EXISTS "Users can view own expenses" ON expenses;
  DROP POLICY IF EXISTS "Admins can view all expenses" ON expenses;
  
  -- Drop profiles policies
  DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
  DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
END $$;

-- Create new non-recursive policies for profiles
CREATE POLICY "Allow users to read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
  );

CREATE POLICY "Allow admins to read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    is_admin()
  );

-- Create new non-recursive policies for time entries
CREATE POLICY "Allow users to read own time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR is_admin()
  );

-- Create new non-recursive policies for expenses
CREATE POLICY "Allow users to read own expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR is_admin()
  );

-- Ensure indexes exist for performance
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND indexname = 'idx_profiles_role_id'
  ) THEN
    CREATE INDEX idx_profiles_role_id ON profiles(role, id);
  END IF;
END $$;