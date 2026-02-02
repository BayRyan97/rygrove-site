-- Add start_date and end_date columns to planner_projects table
ALTER TABLE planner_projects
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add comments for documentation
COMMENT ON COLUMN planner_projects.start_date IS 'Project start date';
COMMENT ON COLUMN planner_projects.end_date IS 'Project end date';
