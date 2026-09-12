CREATE TABLE IF NOT EXISTS public.content_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  botanical_content_id uuid REFERENCES public.botanical_content(id) ON DELETE SET NULL,
  platform text NOT NULL DEFAULT 'tiktok',
  delivery_mode text NOT NULL DEFAULT 'draft',
  status text NOT NULL DEFAULT 'queued',
  idempotency_key text NOT NULL,
  title text,
  caption text,
  remote_publish_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS content_publications_idempotency_key_idx
  ON public.content_publications (idempotency_key);
CREATE INDEX IF NOT EXISTS content_publications_content_idx
  ON public.content_publications (botanical_content_id);

GRANT ALL ON public.content_publications TO service_role;
GRANT SELECT ON public.content_publications TO authenticated;

ALTER TABLE public.content_publications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'content_publications'
       AND policyname = 'Members read publications'
  ) THEN
    CREATE POLICY "Members read publications"
      ON public.content_publications
      FOR SELECT TO authenticated
      USING (public.is_app_member());
  END IF;
END $$;

ALTER TABLE public.tiktok_send_jobs
  ADD COLUMN IF NOT EXISTS publication_id uuid REFERENCES public.content_publications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tiktok_send_jobs_publication_idx
  ON public.tiktok_send_jobs (publication_id);
