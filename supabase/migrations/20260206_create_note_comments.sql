/*
  # Create Note Comments Table
  
  Adds commenting functionality to planner notes for collaborative discussion.
  
  Features:
  - Comments associated with notes
  - Track author and timestamp
  - RLS policies for authenticated users
*/

-- Create note comments table
CREATE TABLE IF NOT EXISTS planner_note_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES planner_notes(id) ON DELETE CASCADE,
  comment_text text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_note_comments_note_id ON planner_note_comments(note_id);
CREATE INDEX idx_note_comments_created_at ON planner_note_comments(created_at DESC);

-- Enable RLS
ALTER TABLE planner_note_comments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all comments
CREATE POLICY "note_comments_select"
  ON planner_note_comments FOR SELECT TO authenticated
  USING (true);

-- Allow authenticated users to insert their own comments
CREATE POLICY "note_comments_insert"
  ON planner_note_comments FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Allow users to update their own comments
CREATE POLICY "note_comments_update"
  ON planner_note_comments FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

-- Allow users to delete their own comments
CREATE POLICY "note_comments_delete"
  ON planner_note_comments FOR DELETE TO authenticated
  USING (created_by = auth.uid());
