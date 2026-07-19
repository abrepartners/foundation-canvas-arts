-- One-clip animation Prompt Lab. All access is service-role only through the
-- protected animated-prompt-lab Edge Function.
CREATE TABLE IF NOT EXISTS public.animation_prompt_lab_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  animation_row_id uuid NOT NULL REFERENCES public.botanical_animated(id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL UNIQUE,
  still_index integer NOT NULL CHECK (still_index BETWEEN 0 AND 5),
  still_url text NOT NULL,
  archetype text NOT NULL CHECK (archetype IN ('growth_reveal', 'living_specimen', 'archival_evidence')),
  model_key text NOT NULL CHECK (model_key IN ('seedance_1_5_pro', 'seedance_2_mini', 'kling_standard')),
  model text NOT NULL,
  duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 2 AND 15),
  resolution text NOT NULL,
  prompt_version text NOT NULL,
  prompt text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'preparing_start_frame', 'submitting_video', 'running', 'succeeded', 'failed', 'canceled')
  ),
  provider_status text,
  estimated_cost_usd numeric(10,4) NOT NULL,
  pricing_version text NOT NULL,
  cost_confirmed_at timestamptz NOT NULL,
  start_frame_prediction_id text,
  start_frame_url text,
  video_prediction_id text,
  output_url text,
  stop_requested_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.animation_prompt_lab_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.animation_prompt_lab_jobs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.animation_prompt_lab_jobs TO service_role;

-- The app is intentionally single-operator. This makes the billing boundary
-- unambiguous: at most one Prompt Lab test can be active across the project.
CREATE UNIQUE INDEX IF NOT EXISTS animation_prompt_lab_one_active_uniq
  ON public.animation_prompt_lab_jobs ((1))
  WHERE status IN ('queued', 'preparing_start_frame', 'submitting_video', 'running');

CREATE INDEX IF NOT EXISTS animation_prompt_lab_row_created_idx
  ON public.animation_prompt_lab_jobs (animation_row_id, created_at DESC);

