-- TikTok delivery jobs contain provider publish ids and operational details.
-- The browser reads them through the passcode-protected status Edge Function,
-- so direct anonymous or authenticated access is unnecessary.
DROP POLICY IF EXISTS "Anyone can read send jobs" ON public.tiktok_send_jobs;

REVOKE SELECT, INSERT, UPDATE, DELETE
  ON public.tiktok_send_jobs
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.tiktok_send_jobs TO service_role;
