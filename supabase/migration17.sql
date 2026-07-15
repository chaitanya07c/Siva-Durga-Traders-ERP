-- Migration 17: Add default_cost column to materials for sales default cost
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS default_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
