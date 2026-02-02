-- Create planner_notes table for post-it style notes
CREATE TABLE IF NOT EXISTS planner_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES planner_projects(id) ON DELETE CASCADE,
  category_id UUID REFERENCES planner_categories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- Add RLS policies for planner_notes
ALTER TABLE planner_notes ENABLE ROW LEVEL SECURITY;

-- Everyone can view notes
CREATE POLICY "Anyone can view planner notes"
  ON planner_notes
  FOR SELECT
  TO authenticated
  USING (true);

-- Anyone can create notes
CREATE POLICY "Anyone can create planner notes"
  ON planner_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Anyone can update notes
CREATE POLICY "Anyone can update planner notes"
  ON planner_notes
  FOR UPDATE
  TO authenticated
  USING (true);

-- Anyone can delete notes
CREATE POLICY "Anyone can delete planner notes"
  ON planner_notes
  FOR DELETE
  TO authenticated
  USING (true);

-- Create index for faster queries
CREATE INDEX idx_planner_notes_project_id ON planner_notes(project_id);
CREATE INDEX idx_planner_notes_category_id ON planner_notes(category_id);
