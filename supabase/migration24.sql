-- Siva Durga Traders ERP - Migration 24
-- Add vehicle_number column to sales table

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS vehicle_number TEXT;

-- Notify PostgREST cache reload
NOTIFY pgrst, 'reload schema';
