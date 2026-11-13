/*
  # Link planner projects to job locations

  Time entries, expenses, estimates and invoices are all keyed by a job
  `location` string. This table lets a planner project claim one or more of
  those locations (to cover spelling variants) so the planner can roll up the
  project's costs and income.
*/

CREATE TABLE IF NOT EXISTS public.planner_project_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.planner_projects(id) ON DELETE CASCADE,
  location text NOT NULL CHECK (length(trim(location)) > 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, location)
);

CREATE INDEX IF NOT EXISTS planner_project_locations_project_idx
  ON public.planner_project_locations (project_id);

ALTER TABLE public.planner_project_locations ENABLE ROW LEVEL SECURITY;

-- Same access model as the other planner tables: everyone signed in can read,
-- admins can change.
DROP POLICY IF EXISTS planner_project_locations_select_policy ON public.planner_project_locations;
CREATE POLICY planner_project_locations_select_policy
  ON public.planner_project_locations FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS planner_project_locations_insert_policy ON public.planner_project_locations;
CREATE POLICY planner_project_locations_insert_policy
  ON public.planner_project_locations FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS planner_project_locations_delete_policy ON public.planner_project_locations;
CREATE POLICY planner_project_locations_delete_policy
  ON public.planner_project_locations FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
