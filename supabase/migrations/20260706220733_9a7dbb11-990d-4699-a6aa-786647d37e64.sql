
CREATE TABLE public.tiktok_send_jobs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  content_id uuid,
  phase text NOT NULL DEFAULT 'queued',
  publish_id text,
  tiktok_status text,
  fail_reason text,
  raw jsonb
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tiktok_send_jobs TO anon, authenticated;
GRANT ALL ON public.tiktok_send_jobs TO service_role;

ALTER TABLE public.tiktok_send_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read send jobs" ON public.tiktok_send_jobs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert send jobs" ON public.tiktok_send_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update send jobs" ON public.tiktok_send_jobs FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX tiktok_send_jobs_created_at_idx ON public.tiktok_send_jobs (created_at DESC);
