/*
  # Unify expenses for standalone + time-linked flows

  Goals:
  - Allow expense rows without time_entry_id
  - Ensure location and description are required for new/updated rows
  - Normalize user ownership and RLS for both standalone and linked expenses
  - Guard against schema drift with IF EXISTS / IF NOT EXISTS
*/

-- Ensure commonly used columns exist in drifted environments
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS date date,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS retailer_id uuid REFERENCES public.retailers(id),
  ADD COLUMN IF NOT EXISTS receipt_image_url text;

-- Standalone expenses should not require a linked time entry
ALTER TABLE public.expenses
  ALTER COLUMN time_entry_id DROP NOT NULL;

-- Backfill ownership and required display fields from linked time entries where possible
UPDATE public.expenses e
SET
  user_id = COALESCE(e.user_id, t.user_id),
  date = COALESCE(e.date, t.date),
  location = COALESCE(e.location, t.location)
FROM public.time_entries t
WHERE e.time_entry_id = t.id
  AND (
    e.user_id IS NULL OR
    e.date IS NULL OR
    e.location IS NULL
  );

-- Enforce required text semantics for new/updated rows without breaking old drifted rows
ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_location_required,
  DROP CONSTRAINT IF EXISTS expenses_description_required;

ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_location_required
    CHECK (location IS NOT NULL AND btrim(location) <> '') NOT VALID,
  ADD CONSTRAINT expenses_description_required
    CHECK (description IS NOT NULL AND btrim(description) <> '') NOT VALID;

-- Helpful indexes for policy/filter performance
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_time_entry_id ON public.expenses(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date_location ON public.expenses(date, location);

-- Drop all existing expenses policies regardless of prior names
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'expenses'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.expenses', policy_record.policyname);
  END LOOP;
END $$;

-- Canonical expenses policies
CREATE POLICY expenses_select
  ON public.expenses FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR time_entry_id IN (SELECT id FROM public.time_entries WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
    )
  );

CREATE POLICY expenses_insert
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR (
      user_id IS NULL
      AND time_entry_id IN (SELECT id FROM public.time_entries WHERE user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
    )
  );

CREATE POLICY expenses_update
  ON public.expenses FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR time_entry_id IN (SELECT id FROM public.time_entries WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
    )
  );

CREATE POLICY expenses_delete
  ON public.expenses FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR time_entry_id IN (SELECT id FROM public.time_entries WHERE user_id = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
    )
  );
