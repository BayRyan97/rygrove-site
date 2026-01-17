/*
  # Create Estimate Worksheets Table

  1. New Tables
    - `estimate_worksheets`
      - `id` (uuid, primary key) - Unique identifier for the estimate
      - `user_id` (uuid, foreign key) - References auth.users
      - `job_name` (text) - Name of the job/project
      - `items` (jsonb) - Array of items with descriptions and costs
      - `overhead_percentage` (decimal) - Percentage for overhead & profit
      - `subtotal` (decimal) - Sum of all item costs
      - `overhead_amount` (decimal) - Calculated overhead amount
      - `total` (decimal) - Final total including overhead
      - `created_at` (timestamptz) - When the estimate was created
      - `updated_at` (timestamptz) - When the estimate was last updated

  2. Security
    - Enable RLS on `estimate_worksheets` table
    - Add policy for authenticated users to read their own estimates
    - Add policy for authenticated users to create their own estimates
    - Add policy for authenticated users to update their own estimates
    - Add policy for authenticated users to delete their own estimates
*/

CREATE TABLE IF NOT EXISTS estimate_worksheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  job_name text NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  overhead_percentage decimal(5,2) NOT NULL DEFAULT 15.00,
  subtotal decimal(12,2) NOT NULL DEFAULT 0,
  overhead_amount decimal(12,2) NOT NULL DEFAULT 0,
  total decimal(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE estimate_worksheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own estimates"
  ON estimate_worksheets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own estimates"
  ON estimate_worksheets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own estimates"
  ON estimate_worksheets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own estimates"
  ON estimate_worksheets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_estimate_worksheets_user_id ON estimate_worksheets(user_id);
CREATE INDEX IF NOT EXISTS idx_estimate_worksheets_created_at ON estimate_worksheets(created_at DESC);
