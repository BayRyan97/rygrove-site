/*
  # Reset Invoice Number Sequence When Table Is Empty

  Fixes invoice numbering so the first invoice after deleting all invoices
  starts back at INV-001001.
*/

CREATE OR REPLACE FUNCTION public.assign_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR btrim(NEW.invoice_number) = '' THEN
    IF NOT EXISTS (SELECT 1 FROM public.invoices LIMIT 1) THEN
      PERFORM setval('public.invoice_number_seq', 1000, true);
    END IF;

    NEW.invoice_number := 'INV-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.invoices LIMIT 1) THEN
    PERFORM setval('public.invoice_number_seq', 1000, true);
  END IF;
END;
$$;
