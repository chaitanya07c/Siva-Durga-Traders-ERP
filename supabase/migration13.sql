ALTER TABLE public.completed_loadings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public all on completed_loadings" ON public.completed_loadings FOR ALL USING (true) WITH CHECK (true);
