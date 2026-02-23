-- Drop overly permissive INSERT and UPDATE policies
DROP POLICY IF EXISTS "Allow public insert" ON public.app_config;
DROP POLICY IF EXISTS "Allow public update" ON public.app_config;

-- Keep SELECT as read-only for the app to load config
-- INSERT and UPDATE are now handled exclusively via the edge function using the service role key