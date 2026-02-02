-- Add color_index and custom_color columns to planner_categories table
ALTER TABLE planner_categories 
ADD COLUMN IF NOT EXISTS color_index INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS custom_color TEXT;

-- Update existing categories to have a color_index based on their current sort_order
UPDATE planner_categories 
SET color_index = sort_order % 8
WHERE color_index IS NULL OR color_index = 0;
