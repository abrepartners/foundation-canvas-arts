-- botanical_content: keep public read, remove public write
DROP POLICY IF EXISTS "Anyone can delete content" ON public.botanical_content;
DROP POLICY IF EXISTS "Anyone can insert content" ON public.botanical_content;
DROP POLICY IF EXISTS "Anyone can update content" ON public.botanical_content;

REVOKE INSERT, UPDATE, DELETE ON public.botanical_content FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.botanical_content FROM authenticated;
GRANT SELECT ON public.botanical_content TO anon;
GRANT SELECT ON public.botanical_content TO authenticated;
GRANT ALL ON public.botanical_content TO service_role;

-- tiktok_send_jobs: keep public read, remove public write
DROP POLICY IF EXISTS "Anyone can insert send jobs" ON public.tiktok_send_jobs;
DROP POLICY IF EXISTS "Anyone can update send jobs" ON public.tiktok_send_jobs;

REVOKE INSERT, UPDATE, DELETE ON public.tiktok_send_jobs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.tiktok_send_jobs FROM authenticated;
GRANT SELECT ON public.tiktok_send_jobs TO anon;
GRANT SELECT ON public.tiktok_send_jobs TO authenticated;
GRANT ALL ON public.tiktok_send_jobs TO service_role;
