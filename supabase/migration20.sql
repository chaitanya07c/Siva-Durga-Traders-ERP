-- Siva Durga Traders ERP - Migration 20
-- Add payment_history column to purchases and sales tables for tracking multi-entry partial payments

ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS payment_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_history JSONB DEFAULT '[]'::jsonb;

-- Notify PostgREST cache reload
NOTIFY pgrst, 'reload schema';
