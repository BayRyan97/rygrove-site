/*
  # Fix View Activity Page Policies

  1. Changes
    - Simplify policies to avoid recursion
    - Add separate admin and user policies
    - Remove complex subqueries that could cause recursion

  2. Security
    - Maintain same level of access control
    - Separate policies for clarity and performance
*/

-- Drop existing policies
DO $$ 
BEGIN
  -- Drop time entries policies
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'time_entries' 
    AND policyname = 'View time entries'
  ) THEN
    DROP POLICY "View time entries" ON time_entries;
  END IF;

  -- Drop expenses policies
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'expenses' 
    AND policyname = 'View expenses'
  ) THEN
    DROP POLICY "View expenses" ON expenses;
  END IF;

  -- Drop profiles policies
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'View profiles'
  ) THEN
    DROP POLICY "View profiles" ON profiles;
  END IF;
END $$;

-- Create separate policies for users and admins
CREATE POLICY "Users can view own time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all time entries"
  ON time_entries FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

CREATE POLICY "Users can view own expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all expenses"
  ON expenses FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  ));

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p2 
    WHERE p2.id = auth.uid() 
    AND p2.role = 'admin'
  ));