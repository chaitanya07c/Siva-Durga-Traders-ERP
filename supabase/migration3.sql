-- Siva Durga Traders ERP - Migration 3 (Sales Items)

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '{}'::jsonb;
