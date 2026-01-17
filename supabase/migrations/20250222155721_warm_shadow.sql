/*
  # Add retailer tracking and receipt storage

  1. Changes
    - Add retailers table for storing unique retailer names
    - Add retailer_id to expenses table
    - Add receipt_image_url to expenses table

  2. Security
    - Enable RLS on retailers table
    - Add policies for retailer access
*/

-- Create retailers table
CREATE TABLE retailers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add retailer_id to expenses
ALTER TABLE expenses ADD COLUMN retailer_id uuid REFERENCES retailers(id);
ALTER TABLE expenses ADD COLUMN receipt_image_url text;

-- Enable RLS on retailers
ALTER TABLE retailers ENABLE ROW LEVEL SECURITY;

-- Retailer policies
CREATE POLICY "Enable read access for all authenticated users to retailers"
  ON retailers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert access for all authenticated users to retailers"
  ON retailers FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create function to handle retailer upsert
CREATE OR REPLACE FUNCTION upsert_retailer(retailer_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  retailer_id uuid;
BEGIN
  -- Try to find existing retailer
  SELECT id INTO retailer_id
  FROM retailers
  WHERE name = retailer_name;

  -- If not found, insert new retailer
  IF retailer_id IS NULL THEN
    INSERT INTO retailers (name)
    VALUES (retailer_name)
    RETURNING id INTO retailer_id;
  END IF;

  RETURN retailer_id;
END;
$$;