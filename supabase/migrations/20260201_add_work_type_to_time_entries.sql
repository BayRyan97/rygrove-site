-- Add work_type and work_type_other to time_entries

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS work_type text[],
  ADD COLUMN IF NOT EXISTS work_type_other text;
