-- Siva Durga Traders ERP - Migration 1

-- 1. Add new columns to shops
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS marked_for_loading BOOLEAN DEFAULT false;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS shop_rates JSONB DEFAULT '{}'::jsonb;

-- 2. Add new columns to sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS remarks TEXT;

-- 3. Create completed_loadings table
CREATE TABLE IF NOT EXISTS public.completed_loadings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    shop_name TEXT NOT NULL,
    shop_type TEXT NOT NULL,
    loading_date DATE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    purchase_bill_number INTEGER,
    purchase_amount DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable RLS and Create Policies for completed_loadings
ALTER TABLE public.completed_loadings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all on completed_loadings" ON public.completed_loadings FOR ALL USING (true) WITH CHECK (true);

-- 5. Create indexes
CREATE INDEX IF NOT EXISTS idx_completed_loadings_shop_id ON public.completed_loadings(shop_id);
CREATE INDEX IF NOT EXISTS idx_completed_loadings_date ON public.completed_loadings(loading_date);
