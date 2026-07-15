-- Siva Durga Traders ERP - Migration 2 (Workers)

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Worker';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS joining_date DATE DEFAULT CURRENT_DATE;
