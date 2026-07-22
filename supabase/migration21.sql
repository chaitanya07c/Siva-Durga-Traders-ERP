-- Siva Durga Traders ERP - Migration 21
-- Add advance column to sales table to support Advance Payments in Sales module

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS advance DECIMAL(12, 2) DEFAULT 0;

-- Notify PostgREST cache reload
NOTIFY pgrst, 'reload schema';
