-- Drop existing policies if they exist
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