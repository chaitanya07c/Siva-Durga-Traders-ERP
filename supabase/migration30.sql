-- Siva Durga Traders ERP - Migration 30
-- Add combinable_shop_ids column to shops table for shop-level Combined Bills configuration

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS combinable_shop_ids JSONB DEFAULT '[]'::jsonb;

-- Notify PostgREST cache reload
NOTIFY pgrst, 'reload schema';
