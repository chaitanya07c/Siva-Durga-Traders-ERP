-- Add shop_rates column safely if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shops' AND column_name = 'shop_rates') THEN
        ALTER TABLE shops ADD COLUMN shop_rates JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Refresh the schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
