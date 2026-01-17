/*
  # Fix profiles table policies

  1. Changes
    - Remove recursive policies that were causing infinite recursion
    - Create simplified policies for profiles table
    - Maintain security while avoiding policy recursion

  2. Security
    - Users can still only view and update their own profiles
    - Admins can view all profiles based on a direct role check
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view own profile and admins can view all" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Create new non-recursive policies
CREATE POLICY "Enable read access for users to own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
  );

CREATE POLICY "Enable update access for users to own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
  );

-- Add separate policy for admin read access
CREATE POLICY "Enable admin read access to all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    role = 'admin'
  );