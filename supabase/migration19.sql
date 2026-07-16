-- Siva Durga Traders ERP - Migration 19
-- Create Expenses Table and RLS Policies

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Enable Public Policy (Allows anyone to perform CRUD - aligned with existing tables)
CREATE POLICY "Allow public all on expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);
