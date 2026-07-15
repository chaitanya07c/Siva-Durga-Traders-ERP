-- Migration 16: Bilingual support columns for business data
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS name_te TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS landmark_te TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS contact_person_te TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS address_te TEXT;

ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS name_te TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS category_te TEXT;

ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS name_te TEXT;

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS name_te TEXT;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
