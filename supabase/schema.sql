-- Siva Durga Traders ERP Database Schema and Seed Data

-- 1. Setup Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Tables
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    landmark TEXT,
    contact_person TEXT,
    mobile TEXT,
    whatsapp TEXT,
    address TEXT,
    purchase_rate TEXT,
    marked_for_loading BOOLEAN DEFAULT false,
    shop_rates JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bill_number SERIAL UNIQUE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    previous_balance DECIMAL(12, 2) DEFAULT 0,
    advance DECIMAL(12, 2) DEFAULT 0,
    grand_total DECIMAL(12, 2) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
    quantity DECIMAL(12, 2) NOT NULL,
    unit TEXT NOT NULL,
    rate DECIMAL(12, 2) NOT NULL,
    total DECIMAL(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    buyer_name TEXT,
    total_amount DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id) ON DELETE CASCADE,
    quantity DECIMAL(12, 2) NOT NULL,
    unit TEXT NOT NULL,
    rate DECIMAL(12, 2) NOT NULL,
    total DECIMAL(12, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    daily_wage DECIMAL(12, 2) NOT NULL,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(employee_id, date)
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

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_purchases_shop_id ON public.purchases(shop_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.purchases(date);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON public.purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_material_id ON public.purchase_items(material_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON public.sales(date);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_material_id ON public.sale_items(material_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON public.attendance(employee_id, date);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies (Allowing Anonymous Access as Auth is Bypassed)
CREATE POLICY "Allow public all on shops" ON public.shops FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on materials" ON public.materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on purchases" ON public.purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on purchase_items" ON public.purchase_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on sale_items" ON public.sale_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on employees" ON public.employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);

-- 7. Seed Materials Data
INSERT INTO public.materials (name, category) VALUES
('Kingfisher Red', 'Bottle Brand'),
('Kingfisher Green', 'Bottle Brand'),
('Kingfisher White', 'Bottle Brand'),
('Budweiser', 'Bottle Brand'),
('Kajora', 'Bottle Brand'),
('10000', 'Bottle Brand'),
('MC Whisky', 'Bottle Brand'),
('Mansion House', 'Bottle Brand'),
('Imperial Blue', 'Bottle Brand'),
('Royal Stag', 'Bottle Brand'),
('IconiQ', 'Bottle Brand'),
('Sterling Reserve B7', 'Bottle Brand'),
('Breezer', 'Bottle Brand'),
('White Glass', 'Other Material'),
('Colour Glass', 'Other Material'),
('Plastic', 'Other Material'),
('Plastic Cover', 'Other Material'),
('Water Bottles', 'Other Material'),
('Iron', 'Other Material'),
('Books', 'Other Material'),
('Atta', 'Other Material')
ON CONFLICT DO NOTHING;

-- 8. Seed Shops Data
-- Iron Shops
INSERT INTO public.shops (name, type, landmark, mobile) VALUES
('Srinu Sanchulu', 'Iron', 'By Pass Gate', '9848613450'),
('Venkatesh', 'Iron', 'Mentay Vari Thota', '6301954086'),
('Ramu', 'Iron', 'B.V.Raju Statue', '9492279929'),
('Vinay', 'Iron', 'D Mart', '9885411624'),
('Thota Ravi', 'Iron', 'DNR', '6302740077'),
('Chiranjeevi', 'Iron', 'Taderu', '9849280794'),
('Yedukodalu', 'Iron', 'Vissakoderu', '8123314166'),
('Markandeyulu', 'Iron', 'Palem Center', '9502414143'),
('Vepakayala Krishna', 'Iron', 'Undi Gate', '9848231657'),
('Reddy Garu', 'Iron', 'Undi Gate', '9989998638'),
('Koti Covers', 'Iron', 'Rayalam', '9542394942'),
('Satya Narayana', 'Iron', 'Rayalam', '9000561162'),
('Kiran Bhasha', 'Iron', 'Rayalam Road', '9290127748'),
('Dhanraj', 'Iron', 'Gollavanitippa', '9573288429'),
('Gollavanitippa Shop', 'Iron', 'Gollavanitippa', '9177774075'),
('Srinu DNR', 'Iron', 'Gollavanitippa Road', '9059111960'),
('Satya Narayana', 'Iron', 'Pallepalem', '9000163742'),
('Suribabu', 'Iron', 'Losari', '8187851344'),
('Bhimaraju', 'Iron', 'Dirusumarru', '9908305510'),
('Mahesh', 'Iron', 'Jakkaram', '9912244377'),
('Sugarcane Juice', 'Iron', 'Kalla', '8125621866'),
('Satish', 'Iron', 'Kalla', '7993704080'),
('Yallarao', 'Iron', 'Kalla', '9000547874'),
('Narendra', 'Iron', 'Juvvalapalem', '7013671991'),
('Shavukaru', 'Iron', 'Juvvalapalem', '9391512697'),
('Shankar', 'Iron', 'Juvvalapalem Road', '9603750559'),
('Subbarao', 'Iron', 'Kolamuru', '8106600669'),
('Naidu', 'Iron', 'Akividu', '9133544044'),
('Ravi Teja (Chinni)', 'Iron', 'Akividu', '7075660034'),
('Raju', 'Iron', 'Akividu', '9346303494'),
('Chanti', 'Iron', 'AMC, Akividu', '9652847199')
ON CONFLICT DO NOTHING;

-- Wine Shops
INSERT INTO public.shops (name, type, landmark, contact_person, mobile) VALUES
('Shiva Wines', 'Wine', 'Vissakoderu', 'Dundi Ashok', '9381491719'),
('GR Wines', 'Wine', 'Vissakoderu', 'Sri Ram', '9948938799'),
('Swapna Wines', 'Wine', 'Vissakoderu Bridge', 'Rajashekar', '9948278799'),
('Venkateswara Wines', 'Wine', 'Vissakoderu Bridge', 'P. Ramu', '9701155601'),
('Vijaya Sai Wines', 'Wine', 'Palem Centre', 'Vishnu', '9705018411'),
('Satya Krishna Wines', 'Wine', 'Wednesday Market', 'D.S.N', '9848567677'),
('VL Bar', 'Wine', 'Wednesday Market', 'Vara Lakshmi Bar', '9642247800'),
('Vijaya Beri Wines', 'Wine', 'B.V.Raju Statue', 'Srinu Pandu', '8125656899'),
('Satya Krishna Bar', 'Wine', 'Nirmala Back Side', 'D.S.N', '9848567677'),
('Gopi Krishna Bar', 'Wine', 'Town Station Road', 'Sai', '8247267697'),
('Vasu Raju Wines', 'Wine', 'Aadha Vantuna', 'V. Ramu', '9395592654'),
('Durga Wines', 'Wine', 'Aadha Vantuna', 'Sathish', '9440521343'),
('Suchitra Wines', 'Wine', 'Padmalaya', 'Shivaji', '8179147599'),
('Suchitra Wines', 'Wine', 'Town Hall', 'Shivaji', '8179147599'),
('Suchitra Wines', 'Wine', 'Fire Office', 'Shivaji', '8179147599'),
('SR Wines', 'Wine', 'Taderu', 'V. Bharath', '9704596677'),
('Friends Wines', 'Wine', 'Matyapur', 'Rambabu', '9704450210'),
('Rajesh Wines', 'Wine', 'Rayakuduru', 'Phani Varma', '9908068621'),
('MSR Wines', 'Wine', 'Nowduru', 'Naga Raju', '9849564236'),
('Vijaya Durga Wines', 'Wine', 'Palakoderu', 'Satish', '9440521343'),
('Durga Bar', 'Wine', 'Juvvalapalem Road', 'Satish', '9440521343'),
('Kasmora Club', 'Wine', 'Juvvalapalem Road', NULL, '9154493170'),
('Dikshitha Wines', 'Wine', 'Dirusumarru', 'Vasu', '9866937730')
ON CONFLICT DO NOTHING;

-- Akividu Wine Shops
INSERT INTO public.shops (name, type, landmark) VALUES
('Amrutha Bar', 'Akividu Wine', NULL),
('Amrutha Wines', 'Akividu Wine', NULL),
('Balaram Wines', 'Akividu Wine', NULL),
('Kick Wines', 'Akividu Wine', 'Dumpagadapa'),
('Anandh Wines', 'Akividu Wine', NULL),
('Jalsa Wines', 'Akividu Wine', NULL),
('Dubai Wines', 'Akividu Wine', NULL),
('Vinayaka Wines', 'Akividu Wine', NULL),
('Satya Wines', 'Akividu Wine', 'Siddapuram'),
('OG Wines', 'Akividu Wine', NULL),
('Sunandha Wines', 'Akividu Wine', NULL),
('Kunapa Reddy Wines', 'Akividu Wine', NULL),
('Lakshmi Wines', 'Akividu Wine', NULL)
ON CONFLICT DO NOTHING;
  
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
  
ALTER TABLE public.completed_loadings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all on completed_loadings" ON public.completed_loadings FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'Pending';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS invoice_number TEXT;

NOTIFY pgrst, 'reload schema';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS partial_payment DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_date DATE;

NOTIFY pgrst, 'reload schema';
-- Migration 16: Bilingual support columns for business data
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS name_te TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS landmark_te TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS contact_person_te TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS address_te TEXT;

ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS name_te TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS category_te TEXT;

ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS name_te TEXT;

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS name_te TEXT;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
