-- Add chart_color column to profiles table for custom user chart colors
-- This allows admins to set custom hex colors for users in activity charts
-- If NULL, the system will auto-generate colors using the existing algorithm

ALTER TABLE profiles
ADD COLUMN chart_color TEXT;

-- Add check constraint to ensure valid hex color format (#RRGGBB)
ALTER TABLE profiles
ADD CONSTRAINT valid_hex_color 
CHECK (chart_color IS NULL OR chart_color ~ '^#[0-9A-Fa-f]{6}$');

-- Add comment for documentation
COMMENT ON COLUMN profiles.chart_color IS 'Custom hex color code for user in activity charts. Format: #RRGGBB. NULL means auto-generated color.';
