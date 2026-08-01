-- Add driver_name and driver_phone columns to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS driver_phone TEXT;
