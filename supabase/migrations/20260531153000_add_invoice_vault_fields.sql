/*
  # Add Invoice Vault Fields

  Adds invoice numbering and payment tracking fields used by Create Invoice "Invoice Vault".
*/

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_payment_status_check'
  ) THEN
    ALTER TABLE public.invoices
      ADD CONSTRAINT invoices_payment_status_check
      CHECK (payment_status IN ('unpaid', 'partial', 'paid'));
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1001;

CREATE OR REPLACE FUNCTION public.assign_invoice_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR btrim(NEW.invoice_number) = '' THEN
    NEW.invoice_number := 'INV-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_invoice_number_on_insert ON public.invoices;

CREATE TRIGGER set_invoice_number_on_insert
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.assign_invoice_number();

UPDATE public.invoices
SET invoice_number = 'INV-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0')
WHERE invoice_number IS NULL OR btrim(invoice_number) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_number_unique
  ON public.invoices(invoice_number)
  WHERE invoice_number IS NOT NULL;
