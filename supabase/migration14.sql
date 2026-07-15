ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS invoice_number TEXT;

NOTIFY pgrst, 'reload schema';
