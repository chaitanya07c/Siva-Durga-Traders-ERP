ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS partial_payment DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_date DATE;

NOTIFY pgrst, 'reload schema';
