-- Siva Durga Traders ERP - Migration 30
-- Trial Feature: Cash & Bank Module Tables

-- 1. Create cash_transactions table
CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL CHECK (type IN ('Received', 'Paid')),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'General',
    remarks TEXT,
    source_module TEXT DEFAULT 'manual',
    source_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create bank_accounts table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_name TEXT NOT NULL,
    account_nickname TEXT NOT NULL,
    account_number TEXT,
    opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create bank_transactions table
CREATE TABLE IF NOT EXISTS public.bank_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL CHECK (type IN ('Credit', 'Debit')),
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'General',
    remarks TEXT,
    source_module TEXT DEFAULT 'manual',
    source_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS and add public permissive policies
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all on cash_transactions" ON public.cash_transactions;
CREATE POLICY "Allow public all on cash_transactions" ON public.cash_transactions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all on bank_accounts" ON public.bank_accounts;
CREATE POLICY "Allow public all on bank_accounts" ON public.bank_accounts FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all on bank_transactions" ON public.bank_transactions;
CREATE POLICY "Allow public all on bank_transactions" ON public.bank_transactions FOR ALL USING (true) WITH CHECK (true);
