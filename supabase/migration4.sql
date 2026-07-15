-- Siva Durga Traders ERP - Migration 4 (Buyers)

CREATE TABLE IF NOT EXISTS public.buyers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all on buyers" ON public.buyers FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.buyers (name) VALUES
('Babi Garu [Rjy]'),
('Subuid Garu'),
('Ranga Garu [Rajolu]'),
('Raju Garu [Box]'),
('Lokesh Garu'),
('Satya Narayana Garu [Books]'),
('Prasadh Garu [Jrg]'),
('Krishna Garu [Nsp]')
ON CONFLICT DO NOTHING;
