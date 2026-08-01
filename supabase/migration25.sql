-- Siva Durga Traders ERP - Migration 25
-- Add mobile column to buyers table

ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS mobile TEXT;

-- Notify PostgREST cache reload
NOTIFY pgrst, 'reload schema';
