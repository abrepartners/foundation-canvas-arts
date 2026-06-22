
ALTER TABLE public.botanical_content
  ADD COLUMN IF NOT EXISTS virality_score integer,
  ADD COLUMN IF NOT EXISTS score_reasoning text,
  ADD COLUMN IF NOT EXISTS hook_variants jsonb,
  ADD COLUMN IF NOT EXISTS queue_status text NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS botanical_content_queue_status_idx
  ON public.botanical_content (queue_status, created_at DESC);

DROP POLICY IF EXISTS "Anyone can update content" ON public.botanical_content;
CREATE POLICY "Anyone can update content"
  ON public.botanical_content
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
