-- Add DELETE policy for time_entries
CREATE POLICY "Users can delete their own time entries and admins can delete any"
  ON time_entries
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
