/*
  # Create Hybrid Invoice Persistence Tables

  Adds invoice persistence for hybrid billing (time + progress rows), with RLS aligned
  to existing admin/supervisor permissions.
*/

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location text,
  estimate_worksheet_id uuid REFERENCES public.estimate_worksheets(id) ON DELETE SET NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  labor_markup_percent numeric(7,2) NOT NULL DEFAULT 0,
  expense_markup_percent numeric(7,2) NOT NULL DEFAULT 0,
  labor_subtotal numeric(12,2) NOT NULL DEFAULT 0,
  progress_subtotal numeric(12,2) NOT NULL DEFAULT 0,
  expense_subtotal numeric(12,2) NOT NULL DEFAULT 0,
  labor_total numeric(12,2) NOT NULL DEFAULT 0,
  expense_total numeric(12,2) NOT NULL DEFAULT 0,
  grand_total numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'void')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_time_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  time_entry_id uuid REFERENCES public.time_entries(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  work_date date NOT NULL,
  hours numeric(8,2) NOT NULL DEFAULT 0,
  base_rate numeric(12,2) NOT NULL DEFAULT 0,
  billing_rate numeric(12,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_estimate_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  estimate_worksheet_id uuid NOT NULL REFERENCES public.estimate_worksheets(id) ON DELETE CASCADE,
  source_item_id text NOT NULL,
  source_item_label text NOT NULL,
  source_value numeric(12,2) NOT NULL DEFAULT 0,
  prior_cumulative_percent numeric(7,2) NOT NULL DEFAULT 0,
  current_cumulative_percent numeric(7,2) NOT NULL DEFAULT 0,
  delta_percent numeric(7,2) NOT NULL DEFAULT 0,
  billed_amount numeric(12,2) NOT NULL DEFAULT 0,
  warning_over_100 boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON public.invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_estimate_worksheet_id ON public.invoices(estimate_worksheet_id);
CREATE INDEX IF NOT EXISTS idx_invoice_time_entry_lines_invoice_id ON public.invoice_time_entry_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_estimate_lines_invoice_id ON public.invoice_estimate_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_estimate_lines_worksheet_item ON public.invoice_estimate_lines(estimate_worksheet_id, source_item_id);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_time_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_estimate_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
    )
  );

CREATE POLICY "Users can create invoices"
  ON public.invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
    )
  );

CREATE POLICY "Users can update invoices"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
    )
  );

CREATE POLICY "Users can delete invoices"
  ON public.invoices FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'supervisor')
    )
  );

CREATE POLICY "Users can view invoice time lines"
  ON public.invoice_time_entry_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_time_entry_lines.invoice_id
        AND (
          i.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('admin', 'supervisor')
          )
        )
    )
  );

CREATE POLICY "Users can write invoice time lines"
  ON public.invoice_time_entry_lines FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_time_entry_lines.invoice_id
        AND (
          i.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('admin', 'supervisor')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_time_entry_lines.invoice_id
        AND (
          i.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('admin', 'supervisor')
          )
        )
    )
  );

CREATE POLICY "Users can view invoice estimate lines"
  ON public.invoice_estimate_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_estimate_lines.invoice_id
        AND (
          i.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('admin', 'supervisor')
          )
        )
    )
  );

CREATE POLICY "Users can write invoice estimate lines"
  ON public.invoice_estimate_lines FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_estimate_lines.invoice_id
        AND (
          i.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('admin', 'supervisor')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_estimate_lines.invoice_id
        AND (
          i.created_by = auth.uid()
          OR EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('admin', 'supervisor')
          )
        )
    )
  );
