/*
  # Partner role + security hardening

  ## Partner role
  A `partner` is someone outside Rygrove (e.g. a co-owner on one job) who can:
  - see only the planner projects they've been granted (planner_project_members)
  - comment on notes in those projects (no other planner edits)
  - see and submit expenses for the job locations linked to those projects
  - see the Project Costs totals for those projects (via a function, so they
    never get direct access to time entries, pay rates, estimates or invoices)

  Partner limits are added as RESTRICTIVE policies, so existing access for
  admins, supervisors and employees is unchanged.

  ## Hardening (affects everyone)
  - Users can no longer change their own `role` or `rate`; only admins can.
  - New sign-ups always start as `employee` (sign-up metadata can't set role).

  Depends on: 20261113180000_add_sort_order_to_planner_tasks.sql,
              20261113190000_create_planner_project_locations.sql
*/

-- ---------------------------------------------------------------------------
-- Project membership for partners
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.planner_project_members (
  project_id uuid NOT NULL REFERENCES public.planner_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS planner_project_members_user_idx ON public.planner_project_members (user_id);

ALTER TABLE public.planner_project_members ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can be used inside policies
-- without recursing through RLS)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_partner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'partner' FROM public.profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE((SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- Projects the current user has been granted as a partner
CREATE OR REPLACE FUNCTION public.partner_project_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT project_id FROM public.planner_project_members WHERE user_id = auth.uid();
$$;

-- Job locations linked to the current user's granted projects
CREATE OR REPLACE FUNCTION public.partner_locations()
RETURNS SETOF text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT l.location
  FROM public.planner_project_locations l
  JOIN public.planner_project_members m ON m.project_id = l.project_id
  WHERE m.user_id = auth.uid();
$$;

-- Notes in the current user's granted projects
CREATE OR REPLACE FUNCTION public.partner_note_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT n.id
  FROM public.planner_notes n
  JOIN public.planner_project_members m ON m.project_id = n.project_id
  WHERE m.user_id = auth.uid();
$$;

-- Categories in the current user's granted projects
CREATE OR REPLACE FUNCTION public.partner_category_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id
  FROM public.planner_categories c
  JOIN public.planner_project_members m ON m.project_id = c.project_id
  WHERE m.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.partner_project_ids(), public.partner_locations(), public.partner_note_ids(), public.partner_category_ids() FROM anon;

-- ---------------------------------------------------------------------------
-- planner_project_members policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS planner_project_members_select ON public.planner_project_members;
CREATE POLICY planner_project_members_select ON public.planner_project_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS planner_project_members_insert ON public.planner_project_members;
CREATE POLICY planner_project_members_insert ON public.planner_project_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS planner_project_members_delete ON public.planner_project_members;
CREATE POLICY planner_project_members_delete ON public.planner_project_members
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- Restrictive partner scoping on planner tables
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS partner_scope ON public.planner_projects;
CREATE POLICY partner_scope ON public.planner_projects
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_partner() OR id IN (SELECT public.partner_project_ids()))
  WITH CHECK (NOT public.is_partner());

DROP POLICY IF EXISTS partner_scope ON public.planner_categories;
CREATE POLICY partner_scope ON public.planner_categories
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_partner() OR project_id IN (SELECT public.partner_project_ids()))
  WITH CHECK (NOT public.is_partner());

DROP POLICY IF EXISTS partner_scope ON public.planner_tasks;
CREATE POLICY partner_scope ON public.planner_tasks
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_partner() OR category_id IN (SELECT public.partner_category_ids()))
  WITH CHECK (NOT public.is_partner());

DROP POLICY IF EXISTS partner_scope ON public.planner_task_notes;
CREATE POLICY partner_scope ON public.planner_task_notes
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    NOT public.is_partner()
    OR task_id IN (SELECT t.id FROM public.planner_tasks t WHERE t.category_id IN (SELECT public.partner_category_ids()))
  )
  WITH CHECK (NOT public.is_partner());

DROP POLICY IF EXISTS partner_scope ON public.planner_project_locations;
CREATE POLICY partner_scope ON public.planner_project_locations
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_partner() OR project_id IN (SELECT public.partner_project_ids()))
  WITH CHECK (NOT public.is_partner());

-- Notes: partners can read notes in their projects but not create/edit/delete
-- (notes are otherwise open to every signed-in user).
DROP POLICY IF EXISTS partner_scope_select ON public.planner_notes;
CREATE POLICY partner_scope_select ON public.planner_notes
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_partner() OR project_id IN (SELECT public.partner_project_ids()));

DROP POLICY IF EXISTS partner_no_insert ON public.planner_notes;
CREATE POLICY partner_no_insert ON public.planner_notes
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.is_partner());

DROP POLICY IF EXISTS partner_no_update ON public.planner_notes;
CREATE POLICY partner_no_update ON public.planner_notes
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_partner());

DROP POLICY IF EXISTS partner_no_delete ON public.planner_notes;
CREATE POLICY partner_no_delete ON public.planner_notes
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_partner());

-- Comments: partners can read and add comments on notes in their projects
DROP POLICY IF EXISTS partner_scope ON public.planner_note_comments;
CREATE POLICY partner_scope ON public.planner_note_comments
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_partner() OR note_id IN (SELECT public.partner_note_ids()))
  WITH CHECK (NOT public.is_partner() OR note_id IN (SELECT public.partner_note_ids()));

-- ---------------------------------------------------------------------------
-- Expenses: partners see/submit only for their projects' job locations
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS partner_expenses_select ON public.expenses;
CREATE POLICY partner_expenses_select ON public.expenses
  FOR SELECT TO authenticated
  USING (public.is_partner() AND location IN (SELECT public.partner_locations()));

DROP POLICY IF EXISTS partner_scope ON public.expenses;
CREATE POLICY partner_scope ON public.expenses
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT public.is_partner() OR location IN (SELECT public.partner_locations()))
  WITH CHECK (NOT public.is_partner() OR (location IN (SELECT public.partner_locations()) AND user_id = auth.uid()));

-- Partners can't read anyone else's time entries, estimates or invoices
-- (existing policies already limit them to their own rows) and only see their
-- own profile row (which hides other people's pay rates).
DROP POLICY IF EXISTS partner_scope ON public.profiles;
CREATE POLICY partner_scope ON public.profiles
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_partner() OR id = auth.uid());

-- ---------------------------------------------------------------------------
-- Names only (no rates/emails/roles), for showing who wrote a comment or
-- submitted an expense. Available to every signed-in user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_profile_names(p_ids uuid[])
RETURNS TABLE (id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.full_name FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.id = ANY (p_ids);
$$;

REVOKE ALL ON FUNCTION public.get_profile_names(uuid[]) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_profile_names(uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Project Costs totals. Admins and members of the project can call it; it
-- returns totals only, never individual time entries or pay rates.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.planner_project_financials(p_project_id uuid)
RETURNS TABLE (budget numeric, labor numeric, labor_hours numeric, materials numeric, billed numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_locations text[];
BEGIN
  IF NOT (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.planner_project_members WHERE project_id = p_project_id AND user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;

  SELECT array_agg(location) INTO v_locations
  FROM public.planner_project_locations WHERE project_id = p_project_id;

  IF v_locations IS NULL THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  RETURN QUERY
  WITH hours AS (
    -- Same math as the invoice page: full days are 9–5, minus lunch
    SELECT
      GREATEST(0,
        EXTRACT(EPOCH FROM (
          (CASE WHEN t.is_full_day THEN '17:00'::time ELSE t.end_time::time END)
          - (CASE WHEN t.is_full_day THEN '09:00'::time ELSE t.start_time::time END)
        )) / 3600
        - COALESCE(EXTRACT(EPOCH FROM t.lunch_break) / 3600, 0)
      ) AS h,
      COALESCE(p.rate, 0) AS rate
    FROM public.time_entries t
    LEFT JOIN public.profiles p ON p.id = t.user_id
    WHERE t.location = ANY (v_locations)
  ),
  latest_estimates AS (
    -- Latest version of each linked job's estimate ("Job", "Job v2", …)
    SELECT DISTINCT ON (regexp_replace(e.job_name, ' v\d+$', ''))
      e.total
    FROM public.estimate_worksheets e
    WHERE regexp_replace(e.job_name, ' v\d+$', '') = ANY (v_locations)
    ORDER BY regexp_replace(e.job_name, ' v\d+$', ''), e.updated_at DESC
  )
  SELECT
    COALESCE((SELECT SUM(total) FROM latest_estimates), 0)::numeric,
    COALESCE((SELECT SUM(h * rate) FROM hours), 0)::numeric,
    COALESCE((SELECT SUM(h) FROM hours), 0)::numeric,
    COALESCE((SELECT SUM(amount) FROM public.expenses WHERE location = ANY (v_locations)), 0)::numeric,
    COALESCE((SELECT SUM(grand_total) FROM public.invoices WHERE location = ANY (v_locations) AND status = 'finalized'), 0)::numeric;
END;
$$;

REVOKE ALL ON FUNCTION public.planner_project_financials(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.planner_project_financials(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Hardening: only admins can change role or pay rate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- auth.uid() is null for service-role / SQL editor changes; allow those
  IF auth.uid() IS NOT NULL
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.rate IS DISTINCT FROM OLD.rate)
     AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can change role or rate' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_privileged_fields ON public.profiles;
CREATE TRIGGER protect_profile_privileged_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_fields();

-- Hardening: sign-up metadata can no longer choose a role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'employee'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
  RETURN new;
END;
$$;
