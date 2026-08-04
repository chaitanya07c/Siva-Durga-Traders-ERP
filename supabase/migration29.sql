-- Siva Durga Traders ERP - Migration 29
-- Centralized Recycle Bin & Retention Policy (30 days)

-- 1. Ensure recycle_bin table exists with all required columns
CREATE TABLE IF NOT EXISTS public.recycle_bin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL DEFAULT 'purchase_bill',
    item_id TEXT NOT NULL,
    title TEXT NOT NULL,
    shop_name TEXT,
    bill_number TEXT,
    amount DECIMAL(12, 2) DEFAULT 0,
    data JSONB NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add expires_at column if missing (for existing table)
ALTER TABLE public.recycle_bin ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days');

-- 3. Populate missing expires_at for existing rows
UPDATE public.recycle_bin
SET expires_at = deleted_at + INTERVAL '30 days'
WHERE expires_at IS NULL AND deleted_at IS NOT NULL;

-- 4. Enable RLS and add public permissive policies (Fixes RLS Error 42501)
ALTER TABLE public.recycle_bin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all on recycle_bin" ON public.recycle_bin;
CREATE POLICY "Allow public all on recycle_bin" ON public.recycle_bin FOR ALL USING (true) WITH CHECK (true);

-- 5. Auto-delete function to purge records older than 30 days
CREATE OR REPLACE FUNCTION public.purge_expired_recycle_bin_items()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.recycle_bin
  WHERE expires_at <= NOW() OR deleted_at < (NOW() - INTERVAL '30 days');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger on SELECT / INSERT to auto-purge expired items automatically
CREATE OR REPLACE FUNCTION public.trigger_purge_expired_recycle_bin()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.recycle_bin
  WHERE expires_at <= NOW() OR deleted_at < (NOW() - INTERVAL '30 days');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger BEFORE INSERT on recycle_bin
DROP TRIGGER IF EXISTS trg_purge_expired_recycle_bin ON public.recycle_bin;
CREATE TRIGGER trg_purge_expired_recycle_bin
BEFORE INSERT ON public.recycle_bin
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_purge_expired_recycle_bin();

-- 7. Notify PostgREST cache reload
NOTIFY pgrst, 'reload schema';
