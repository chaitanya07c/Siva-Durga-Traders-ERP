-- Add unit column to materials table and shop_units column to shops table
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'Nos';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS shop_units JSONB NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
