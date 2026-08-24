-- ============================================================================
-- SIVA DURGA TRADERS ERP - MASTER DATABASE SCHEMA (Production v2.0)
-- Consolidates all baseline tables, columns, indexes, constraints, views,
-- functions, triggers, and RLS policies (from migration1.sql to migration30.sql).
-- ============================================================================

-- ============================================================================
-- 1. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- 2.1 SHOPS REGISTRY
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    name_te TEXT,
    type TEXT NOT NULL, -- 'Wine', 'Akividu Wine', 'Iron', 'Local Shop'
    landmark TEXT,
    landmark_te TEXT,
    contact_person TEXT,
    contact_person_te TEXT,
    mobile TEXT,
    whatsapp TEXT,
    address TEXT,
    address_te TEXT,
    purchase_rate TEXT,
    marked_for_loading BOOLEAN DEFAULT false,
    marked_for_combined_bill BOOLEAN NOT NULL DEFAULT false,
    combinable_shop_ids JSONB DEFAULT '[]'::jsonb,
    shop_rates JSONB NOT NULL DEFAULT '{}'::jsonb,
    shop_units JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.2 MATERIALS / PRODUCTS CATALOG
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    name_te TEXT,
    category TEXT NOT NULL, -- 'Beer Bottles', 'Liquor Bottles', 'Other Items'
    category_te TEXT,
    default_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    unit TEXT NOT NULL DEFAULT 'Kg',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.3 BUYERS DIRECTORY
CREATE TABLE IF NOT EXISTS public.buyers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    name_te TEXT,
    mobile TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.4 PURCHASING BILLS (Supplier Invoices)
CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_number SERIAL UNIQUE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    previous_balance DECIMAL(12, 2) DEFAULT 0,
    advance DECIMAL(12, 2) DEFAULT 0,
    grand_total DECIMAL(12, 2) NOT NULL,
    remarks TEXT,
    payment_status TEXT DEFAULT 'Pending',
    session_id UUID DEFAULT uuid_generate_v4(),
    session_partial_payment DECIMAL(12, 2) DEFAULT 0,
    payment_date DATE,
    payment_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.5 PURCHASING BILL ITEMS
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
    item_name TEXT,
    quantity DECIMAL(12, 2) NOT NULL,
    unit TEXT NOT NULL,
    rate DECIMAL(12, 2) NOT NULL,
    total DECIMAL(12, 2) NOT NULL
);

-- 2.6 SALES BILLS (Customer Invoices)
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    buyer_name TEXT,
    total_amount DECIMAL(12, 2) NOT NULL,
    advance DECIMAL(12, 2) DEFAULT 0,
    invoice_number TEXT,
    payment_status TEXT DEFAULT 'Pending',
    partial_payment DECIMAL(12, 2) DEFAULT 0,
    payment_date DATE,
    payment_history JSONB DEFAULT '[]'::jsonb,
    remarks TEXT,
    vehicle_number TEXT,
    driver_name TEXT,
    driver_phone TEXT,
    items JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.7 SALES BILL ITEMS (Historic / Relational Reference)
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
    quantity DECIMAL(12, 2) NOT NULL,
    unit TEXT NOT NULL,
    rate DECIMAL(12, 2) NOT NULL,
    total DECIMAL(12, 2) NOT NULL
);

-- 2.8 EMPLOYEES / WORKERS DIRECTORY
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    name_te TEXT,
    gender TEXT DEFAULT 'Gents',
    daily_wage DECIMAL(12, 2) NOT NULL,
    status TEXT DEFAULT 'Active',
    mobile TEXT,
    role TEXT DEFAULT 'Worker',
    joining_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.9 WORKER ATTENDANCE LOGS
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL, -- 'Present', 'Absent', 'Half Day'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, date)
);

-- 2.10 COMPLETED LOADING LOGS
CREATE TABLE IF NOT EXISTS public.completed_loadings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    shop_name TEXT NOT NULL,
    shop_type TEXT NOT NULL,
    loading_date DATE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    purchase_bill_number BIGINT,
    purchase_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.11 EXPENSES REGISTER
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2.12 RECYCLE BIN & 30-DAY RETENTION
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
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to purge expired items (> 30 days) from recycle bin
CREATE OR REPLACE FUNCTION public.purge_expired_recycle_bin_items()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.recycle_bin
  WHERE expires_at <= NOW() OR deleted_at < (NOW() - INTERVAL '30 days');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to automatically purge expired records before any insert
CREATE OR REPLACE FUNCTION public.trigger_purge_expired_recycle_bin()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM public.recycle_bin
  WHERE expires_at <= NOW() OR deleted_at < (NOW() - INTERVAL '30 days');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_purge_expired_recycle_bin ON public.recycle_bin;
CREATE TRIGGER trg_purge_expired_recycle_bin
BEFORE INSERT ON public.recycle_bin
FOR EACH STATEMENT
EXECUTE FUNCTION public.trigger_purge_expired_recycle_bin();

-- ============================================================================
-- 4. DATABASE VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW public.current_stock AS
SELECT 
    m.id AS material_id,
    m.name,
    m.category,
    COALESCE(SUM(pi.quantity), 0) AS total_purchased,
    COALESCE((SELECT SUM(si.quantity) FROM public.sale_items si WHERE si.material_id = m.id), 0) AS total_sold,
    COALESCE(SUM(pi.quantity), 0) - COALESCE((SELECT SUM(si.quantity) FROM public.sale_items si WHERE si.material_id = m.id), 0) AS current_quantity
FROM 
    public.materials m
LEFT JOIN 
    public.purchase_items pi ON m.id = pi.material_id
GROUP BY 
    m.id, m.name, m.category;

-- ============================================================================
-- 5. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_purchases_shop_id ON public.purchases(shop_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.purchases(date);
CREATE INDEX IF NOT EXISTS idx_purchases_session ON public.purchases(session_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_material_id ON public.purchase_items(material_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_material_id ON public.sale_items(material_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON public.attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_completed_loadings_shop ON public.completed_loadings(shop_id);
CREATE INDEX IF NOT EXISTS idx_completed_loadings_date ON public.completed_loadings(loading_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);
CREATE INDEX IF NOT EXISTS idx_recycle_bin_expires ON public.recycle_bin(expires_at);

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) & POLICIES
-- ============================================================================

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completed_loadings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recycle_bin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all on shops" ON public.shops;
CREATE POLICY "Allow public all on shops" ON public.shops FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on materials" ON public.materials;
CREATE POLICY "Allow public all on materials" ON public.materials FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on buyers" ON public.buyers;
CREATE POLICY "Allow public all on buyers" ON public.buyers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on purchases" ON public.purchases;
CREATE POLICY "Allow public all on purchases" ON public.purchases FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on purchase_items" ON public.purchase_items;
CREATE POLICY "Allow public all on purchase_items" ON public.purchase_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on sales" ON public.sales;
CREATE POLICY "Allow public all on sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on sale_items" ON public.sale_items;
CREATE POLICY "Allow public all on sale_items" ON public.sale_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on employees" ON public.employees;
CREATE POLICY "Allow public all on employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on attendance" ON public.attendance;
CREATE POLICY "Allow public all on attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on completed_loadings" ON public.completed_loadings;
CREATE POLICY "Allow public all on completed_loadings" ON public.completed_loadings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on expenses" ON public.expenses;
CREATE POLICY "Allow public all on expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all on recycle_bin" ON public.recycle_bin;
CREATE POLICY "Allow public all on recycle_bin" ON public.recycle_bin FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 7. NOTIFY POSTGREST SCHEMA CACHE RELOAD
-- ============================================================================
NOTIFY pgrst, 'reload schema';
