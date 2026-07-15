-- Siva Durga Traders ERP - Migration 6 (Purchases Payment Status)

-- Add payment_status column to purchases
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';

-- Update all existing older purchases to 'Completed' so they don't clutter the new Pending Bills screen
UPDATE public.purchases SET payment_status = 'Completed' WHERE payment_status = 'Pending';
