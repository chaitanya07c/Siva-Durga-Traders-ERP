-- Update default unit for materials table: Beer Bottles -> Nos, All other categories -> Kg
ALTER TABLE public.materials ALTER COLUMN unit SET DEFAULT 'Kg';

UPDATE public.materials
SET unit = 'Nos'
WHERE LOWER(category) IN ('beer bottles', 'beer bottle')
   OR LOWER(name) LIKE '%kingfisher%'
   OR LOWER(name) LIKE '%budweiser%'
   OR LOWER(name) LIKE '%tuborg%'
   OR LOWER(name) LIKE '%carlsberg%';

UPDATE public.materials
SET unit = 'Kg'
WHERE LOWER(category) NOT IN ('beer bottles', 'beer bottle')
  AND (unit IS NULL OR unit = 'Nos');

NOTIFY pgrst, 'reload schema';
