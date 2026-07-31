-- Siva Durga Traders ERP - Migration 23
-- Add gender column to employees table to support Gents and Ladies classification

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'Gents';

-- Notify PostgREST cache reload
NOTIFY pgrst, 'reload schema';
