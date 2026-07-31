-- Siva Durga Traders ERP - Migration 22
-- Create recycle_bin table for deleted purchase bills and items

CREATE TABLE IF NOT EXISTS public.recycle_bin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL DEFAULT 'purchase_bill',
    item_id TEXT NOT NULL,
    title TEXT NOT NULL,
    shop_name TEXT,
    bill_number TEXT,
    amount DECIMAL(12, 2) DEFAULT 0,
    data JSONB NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notify PostgREST cache reload
NOTIFY pgrst, 'reload schema';
