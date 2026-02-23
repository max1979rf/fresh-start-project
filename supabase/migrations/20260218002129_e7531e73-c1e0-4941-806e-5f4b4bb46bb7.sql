
-- Table to persist app configuration
CREATE TABLE public.app_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Allow anyone to read/write (app uses custom auth, not Supabase auth)
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.app_config FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.app_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.app_config FOR UPDATE USING (true);

-- Seed with empty config
INSERT INTO public.app_config (id, config) VALUES ('default', '{}');
