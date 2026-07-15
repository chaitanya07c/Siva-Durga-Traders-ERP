CREATE TABLE IF NOT EXISTS public.completed_loadings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    shop_name TEXT NOT NULL,
    shop_type TEXT NOT NULL,
    loading_date DATE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    purchase_bill_number BIGINT,
    purchase_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Refresh the schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
