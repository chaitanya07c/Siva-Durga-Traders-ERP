-- Siva Durga Traders ERP - Migration 5 (Dynamic Sales Items Cleanup)

-- Update Beer Bottles
UPDATE public.materials SET category = 'Beer Bottles' WHERE name IN (
    'Kingfisher Red', 'Kingfisher Green', 'Kingfisher White', 'Budweiser', 'Kajora', '10000'
);

-- Update Liquor Bottles
UPDATE public.materials SET category = 'Liquor Bottles' WHERE name IN (
    'MC Whisky', 'Mansion House', 'Imperial Blue', 'Royal Stag', 'IconiQ', 'Sterling Reserve B7', 'Breezer'
);

-- Update Other Items
UPDATE public.materials SET category = 'Other Items' WHERE category = 'Other Material';

-- Insert Kingfisher [Red] style names if they differ from existing seed data
-- (The seed data has 'Kingfisher Red', but the prompt specifically lists 'Kingfisher [Red]')
-- To avoid duplicates in purchasing vs sales if they use the same item, it's best to rename the existing ones to match exactly.
UPDATE public.materials SET name = 'Kingfisher [Red]' WHERE name = 'Kingfisher Red';
UPDATE public.materials SET name = 'Kingfisher [Green]' WHERE name = 'Kingfisher Green';
UPDATE public.materials SET name = 'Kingfisher [White]' WHERE name = 'Kingfisher White';
UPDATE public.materials SET name = '10,000' WHERE name = '10000';
