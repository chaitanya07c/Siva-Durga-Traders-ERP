-- Add marked_for_combined_bill column to shops table
ALTER TABLE public.shops ADD COLUMN marked_for_combined_bill BOOLEAN NOT NULL DEFAULT false;
