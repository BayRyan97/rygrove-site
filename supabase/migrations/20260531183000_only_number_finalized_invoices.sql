/*
  # Only Number Finalized Invoices

  Prevent draft autosaves from consuming invoice numbers.
  This keeps invoice numbering stable and ensures first finalized invoice
  is INV-001001 when there are no finalized invoices.
*/

CREATE OR REPLACE FUNCTION public.assign_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  max_finalized_number bigint;
BEGIN
  IF NEW.status = 'finalized' AND (NEW.invoice_number IS NULL OR btrim(NEW.invoice_number) = '') THEN
    SELECT COALESCE(MAX(substring(invoice_number from 5)::bigint), 1000)
    INTO max_finalized_number
    FROM public.invoices
    WHERE status = 'finalized'
      AND invoice_number ~ '^INV-[0-9]{6}$';

    PERFORM setval('public.invoice_number_seq', max_finalized_number, true);
    NEW.invoice_number := 'INV-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
  END IF;

  RETURN NEW;
END;
$$;

-- Draft invoices should never hold official invoice numbers.
UPDATE public.invoices
SET invoice_number = NULL
WHERE status = 'draft';

-- Align sequence with current finalized invoice max.
DO $$
DECLARE
  max_finalized_number bigint;
BEGIN
  SELECT COALESCE(MAX(substring(invoice_number from 5)::bigint), 1000)
  INTO max_finalized_number
  FROM public.invoices
  WHERE status = 'finalized'
    AND invoice_number ~ '^INV-[0-9]{6}$';

  PERFORM setval('public.invoice_number_seq', max_finalized_number, true);
END;
$$;
