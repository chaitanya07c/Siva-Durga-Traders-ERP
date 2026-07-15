-- Add marked_for_loading column safely if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'marked_for_loading') THEN
        ALTER TABLE shops ADD COLUMN marked_for_loading BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Refresh the schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
