-- Siva Durga Traders ERP - Migration 7 (Purchase Items Name Fix)

-- Add item_name column to purchase_items so that fixed items (like Beer) can be saved even if they don't exist in materials table
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS item_name TEXT;
