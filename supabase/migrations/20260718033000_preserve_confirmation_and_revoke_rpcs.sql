-- A stills-ready run is intentionally waiting for a human cost confirmation.
-- It must not be auto-expired merely because review takes longer than the
-- stale worker threshold. Only actively executing stages are recoverable.
ALTER TABLE public.animation_provider_jobs
  ADD COLUMN IF NOT EXISTS output_data text;

-- A local poll timeout never proves the provider prediction ended. Preserve
-- those ids as active so retries poll or cancel the same job instead of
-- submitting a replacement.
UPDATE public.animation_provider_jobs target
   SET status = 'running',
       error = COALESCE(error, 'poll timeout; provider status unknown'),
       updated_at = now()
 WHERE target.id IN (
   SELECT DISTINCT ON (expired.row_id, expired.job_key) expired.id
     FROM public.animation_provider_jobs expired
    WHERE expired.status = 'expired'
      AND expired.prediction_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
          FROM public.animation_provider_jobs active
         WHERE active.row_id = expired.row_id
           AND active.job_key = expired.job_key
           AND active.status IN ('claimed','submitting','running')
      )
    ORDER BY expired.row_id, expired.job_key, expired.attempt DESC
 );

-- Include every field used by guarded background handoffs. The earlier
-- version intentionally covered stage fields only, but the start handoff also
-- needs to attach the generated source and content metadata atomically.
CREATE OR REPLACE FUNCTION public.guarded_update_animated(
  _row_id uuid,
  _patch jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur_status text;
  cur_stop timestamptz;
BEGIN
  SELECT queue_status, stop_requested_at INTO cur_status, cur_stop
    FROM public.botanical_animated WHERE id = _row_id FOR UPDATE;
  IF cur_status IS NULL THEN RETURN false; END IF;
  IF cur_stop IS NOT NULL THEN RETURN false; END IF;
  IF cur_status IN ('canceled','error','done') THEN RETURN false; END IF;

  UPDATE public.botanical_animated
     SET queue_status    = COALESCE(_patch->>'queue_status', queue_status),
         source_content_id = CASE
           WHEN _patch ? 'source_content_id'
             THEN NULLIF(_patch->>'source_content_id', '')::uuid
           ELSE source_content_id
         END,
         plant_name      = COALESCE(_patch->>'plant_name', plant_name),
         verified_fact   = COALESCE(_patch->>'verified_fact', verified_fact),
         script          = COALESCE(_patch->'script', script),
         caption         = COALESCE(_patch->>'caption', caption),
         progress        = COALESCE(_patch->'progress', progress),
         clip_urls       = COALESCE(
                             CASE WHEN _patch ? 'clip_urls'
                                  THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'clip_urls'))
                                  ELSE NULL END,
                             clip_urls),
         still_urls      = COALESCE(
                             CASE WHEN _patch ? 'still_urls'
                                  THEN ARRAY(SELECT jsonb_array_elements_text(_patch->'still_urls'))
                                  ELSE NULL END,
                             still_urls),
         final_video_url = COALESCE(_patch->>'final_video_url', final_video_url),
         cost_breakdown  = COALESCE(_patch->'cost_breakdown', cost_breakdown),
         cost_usd        = COALESCE(NULLIF(_patch->>'cost_usd','')::numeric, cost_usd),
         error           = CASE WHEN _patch ? 'error' THEN _patch->>'error' ELSE error END,
         updated_at      = now()
   WHERE id = _row_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.guarded_update_animated(uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.expire_stale_active_animated(
  _threshold_seconds integer DEFAULT 1800
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  WITH candidates AS (
    SELECT ba.id
      FROM public.botanical_animated ba
     WHERE ba.queue_status IN ('generating','animating','stitching')
       AND ba.updated_at < now() - make_interval(secs => _threshold_seconds)
       AND ba.stop_requested_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.animation_provider_jobs pj
          WHERE pj.row_id = ba.id
            AND pj.status IN ('claimed','submitting','running')
       )
  )
  UPDATE public.botanical_animated ba
     SET queue_status = 'error',
         error = COALESCE(NULLIF(ba.error,''), '') ||
                 CASE WHEN COALESCE(ba.error,'') = '' THEN '' ELSE ' | ' END ||
                 'Auto-expired: stale active row (no in-flight provider jobs, '
                 || 'idle > ' || _threshold_seconds || 's).',
         updated_at = now()
   WHERE ba.id IN (SELECT id FROM candidates);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_active_animated(integer) TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.botanical_animated FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.animation_provider_jobs FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_animation_retry(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_provider_job(uuid, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guarded_update_animated(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_active_animated(integer) FROM PUBLIC, anon, authenticated;
