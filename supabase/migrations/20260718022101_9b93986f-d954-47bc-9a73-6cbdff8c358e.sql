
-- 1. Provider jobs table (idempotency + durable prediction tracking)
CREATE TABLE IF NOT EXISTS public.animation_provider_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id uuid NOT NULL REFERENCES public.botanical_animated(id) ON DELETE CASCADE,
  job_key text NOT NULL,
  provider text NOT NULL DEFAULT 'replicate',
  model text,
  prediction_id text,
  status text NOT NULL DEFAULT 'claimed',
  attempt integer NOT NULL DEFAULT 1,
  output_url text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.animation_provider_jobs TO anon, authenticated;
GRANT ALL ON public.animation_provider_jobs TO service_role;

ALTER TABLE public.animation_provider_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read provider jobs" ON public.animation_provider_jobs;
CREATE POLICY "Anyone can read provider jobs"
  ON public.animation_provider_jobs FOR SELECT USING (true);
-- No insert/update/delete policies -> anon and authenticated cannot write.

-- One active (non-terminal) job per (row, job_key)
CREATE UNIQUE INDEX IF NOT EXISTS animation_provider_jobs_active_uniq
  ON public.animation_provider_jobs (row_id, job_key)
  WHERE status IN ('claimed','submitting','running');

CREATE INDEX IF NOT EXISTS animation_provider_jobs_row_key_attempt_idx
  ON public.animation_provider_jobs (row_id, job_key, attempt DESC);

-- 2. Lock down botanical_animated writes
REVOKE INSERT, UPDATE, DELETE ON public.botanical_animated FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.botanical_animated FROM authenticated;
DROP POLICY IF EXISTS "Anyone can insert animated" ON public.botanical_animated;
DROP POLICY IF EXISTS "Anyone can update animated" ON public.botanical_animated;
DROP POLICY IF EXISTS "Anyone can delete animated" ON public.botanical_animated;
-- Retain the existing SELECT policy for read/realtime access.

-- 3. New columns for stop, cost confirmation, retry budgets
ALTER TABLE public.botanical_animated
  ADD COLUMN IF NOT EXISTS retry_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS stop_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cost_confirmed_estimate_usd numeric(10,4),
  ADD COLUMN IF NOT EXISTS cost_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pricing_version text;

-- 4. Enforce a single active run at any time.
-- Uses an always-true expression so multiple active rows collide on the index.
CREATE UNIQUE INDEX IF NOT EXISTS botanical_animated_single_active_uniq
  ON public.botanical_animated ((queue_status IS NOT NULL))
  WHERE queue_status IN ('pending_confirmation','generating','stills_ready','animating','stitching');
