-- Siva Durga Traders ERP Database Schema (Consolidated Production v1.0)

-- 1. Setup Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Tables

-- Shops Registry
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    name_te TEXT,
    type TEXT NOT NULL,
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
    shop_rates JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Materials / Products
CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    name_te TEXT,
    category TEXT NOT NULL,
    category_te TEXT,
    default_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Buyers Directory
CREATE TABLE IF NOT EXISTS public.buyers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    name_te TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchasing Bills (Supplier Invoices)
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchasing Bill Items
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
    quantity DECIMAL(12, 2) NOT NULL,
    unit TEXT NOT NULL,
    rate DECIMAL(12, 2) NOT NULL,
    total DECIMAL(12, 2) NOT NULL,
    item_name TEXT
);

-- Sales Bills (Customer Invoices)
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    buyer_name TEXT,
    total_amount DECIMAL(12, 2) NOT NULL,
    invoice_number TEXT,
    payment_status TEXT DEFAULT 'Pending',
    partial_payment DECIMAL(12, 2) DEFAULT 0,
    payment_date DATE,
    remarks TEXT,
    items JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sales Bill Items (Historic / Relational Reference)
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
    quantity DECIMAL(12, 2) NOT NULL,
    unit TEXT NOT NULL,
    rate DECIMAL(12, 2) NOT NULL,
    total DECIMAL(12, 2) NOT NULL
);

-- Employees Directory
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    name_te TEXT,
    daily_wage DECIMAL(12, 2) NOT NULL,
    status TEXT DEFAULT 'Active',
    mobile TEXT,
    role TEXT DEFAULT 'Worker',
    joining_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Worker Attendance Registry
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, date)
);

-- Completed Loading Log
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

-- 3. Create Current Stock View
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

-- 4. Create Database Indexes
CREATE INDEX IF NOT EXISTS idx_purchases_shop_id ON public.purchases(shop_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.purchases(date);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_material_id ON public.purchase_items(material_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_material_id ON public.sale_items(material_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON public.attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_completed_loadings_shop ON public.completed_loadings(shop_id);

-- 5. Enable Row Level Security (RLS)
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

-- 6. Create RLS Policies
CREATE POLICY "Allow public all on shops" ON public.shops FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on materials" ON public.materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on buyers" ON public.buyers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on purchases" ON public.purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on purchase_items" ON public.purchase_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on sale_items" ON public.sale_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on completed_loadings" ON public.completed_loadings FOR ALL USING (true) WITH CHECK (true);

-- 7. PostgREST Cache Refresh Notification
NOTIFY pgrst, 'reload schema';
