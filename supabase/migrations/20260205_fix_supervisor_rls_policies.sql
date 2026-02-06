/*
  # Fix Supervisor RLS Policies - WORKING VERSION
  
  Key Fix: Avoid circular dependency by allowing all authenticated users to read profiles.
  This allows time_entries policies to safely check profiles.role without creating infinite loops.
  
  Allows supervisors to:
  - View all time entries
  - Insert/update/delete time entries for any user
  - View all expenses
  - View all profiles
  
  Security: Supervisors cannot access admin dashboard (enforced at application level)
*/

-- =====================================================
-- PROFILES - Simple policy to avoid circular dependency
-- =====================================================

DROP POLICY IF EXISTS "profiles_all_access" ON profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile and admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile and admins can view all" ON profiles;

-- Allow all authenticated users to read profiles (needed for role checks)
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT TO authenticated
  USING (true);

-- =====================================================
-- TIME ENTRIES - With supervisor support
-- =====================================================

DROP POLICY IF EXISTS "time_entries_all_access" ON time_entries;
DROP POLICY IF EXISTS "time_entries_select_policy" ON time_entries;
DROP POLICY IF EXISTS "time_entries_insert_policy" ON time_entries;
DROP POLICY IF EXISTS "time_entries_update_policy" ON time_entries;
DROP POLICY IF EXISTS "time_entries_delete_policy" ON time_entries;
DROP POLICY IF EXISTS "time_entries_select" ON time_entries;
DROP POLICY IF EXISTS "time_entries_insert" ON time_entries;
DROP POLICY IF EXISTS "time_entries_update" ON time_entries;
DROP POLICY IF EXISTS "time_entries_delete" ON time_entries;
DROP POLICY IF EXISTS "Allow supervisors to select time entries for others" ON time_entries;
DROP POLICY IF EXISTS "Allow supervisors to insert time entries for others" ON time_entries;
DROP POLICY IF EXISTS "Restrict supervisors from viewing cost data" ON time_entries;
DROP POLICY IF EXISTS "Users can view their own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can insert their own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can update their own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can view own entries and admins can view all" ON time_entries;
DROP POLICY IF EXISTS "Users can insert own entries and admins can insert for any" ON time_entries;
DROP POLICY IF EXISTS "Users can update own entries and admins can update all" ON time_entries;

CREATE POLICY "time_entries_select"
  ON time_entries FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'supervisor'))
  );

CREATE POLICY "time_entries_insert"
  ON time_entries FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'supervisor'))
  );

CREATE POLICY "time_entries_update"
  ON time_entries FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'supervisor'))
  );

CREATE POLICY "time_entries_delete"
  ON time_entries FOR DELETE TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'supervisor'))
  );

-- =====================================================
-- EXPENSES - With supervisor support
-- =====================================================

DROP POLICY IF EXISTS "expenses_all_access" ON expenses;
DROP POLICY IF EXISTS "expenses_select" ON expenses;
DROP POLICY IF EXISTS "expenses_insert" ON expenses;
DROP POLICY IF EXISTS "expenses_update" ON expenses;
DROP POLICY IF EXISTS "expenses_delete" ON expenses;

CREATE POLICY "expenses_select"
  ON expenses FOR SELECT TO authenticated
  USING (
    time_entry_id IN (SELECT id FROM time_entries WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'supervisor'))
  );

CREATE POLICY "expenses_insert"
  ON expenses FOR INSERT TO authenticated
  WITH CHECK (
    time_entry_id IN (SELECT id FROM time_entries WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'supervisor'))
  );

CREATE POLICY "expenses_update"
  ON expenses FOR UPDATE TO authenticated
  USING (
    time_entry_id IN (SELECT id FROM time_entries WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'supervisor'))
  );

CREATE POLICY "expenses_delete"
  ON expenses FOR DELETE TO authenticated
  USING (
    time_entry_id IN (SELECT id FROM time_entries WHERE user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'supervisor'))
  );
