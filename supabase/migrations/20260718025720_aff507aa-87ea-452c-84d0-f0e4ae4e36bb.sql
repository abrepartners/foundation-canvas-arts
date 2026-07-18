
-- 1. Atomic retry budget increment (used by animated-start-resume + still recovery).
CREATE OR REPLACE FUNCTION public.consume_animation_retry(
  _row_id uuid,
  _bucket text,
  _limit_value integer
) RETURNS TABLE(allowed boolean, used integer, limit_value integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur integer;
  nxt integer;
BEGIN
  SELECT COALESCE((retry_counts ->> _bucket)::int, 0) INTO cur
    FROM public.botanical_animated
   WHERE id = _row_id
   FOR UPDATE;
  IF cur IS NULL THEN
    RETURN QUERY SELECT false, 0, _limit_value;
    RETURN;
  END IF;
  IF cur >= _limit_value THEN
    RETURN QUERY SELECT false, cur, _limit_value;
    RETURN;
  END IF;
  nxt := cur + 1;
  UPDATE public.botanical_animated
     SET retry_counts = retry_counts || jsonb_build_object(_bucket, nxt),
         updated_at = now()
   WHERE id = _row_id;
  RETURN QUERY SELECT true, nxt, _limit_value;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_animation_retry(uuid, text, integer) TO service_role;

-- 2. Atomic provider-job claim serialised on the parent row.
-- Returns claimed=true only when this call created the new attempt.
-- Returns exhausted=true when max attempts have been consumed.
CREATE OR REPLACE FUNCTION public.claim_provider_job(
  _row_id uuid,
  _job_key text,
  _provider text,
  _model text,
  _max_attempts integer
) RETURNS TABLE(
  claimed boolean,
  exhausted boolean,
  job_id uuid,
  job_status text,
  attempt integer,
  prediction_id text,
  output_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_row public.animation_provider_jobs%ROWTYPE;
  latest_row public.animation_provider_jobs%ROWTYPE;
  new_row public.animation_provider_jobs%ROWTYPE;
  attempts_total integer;
BEGIN
  PERFORM 1 FROM public.botanical_animated WHERE id = _row_id FOR UPDATE;

  -- Active in-flight attempt wins; caller must wait for it.
  SELECT * INTO active_row
    FROM public.animation_provider_jobs
   WHERE row_id = _row_id AND job_key = _job_key
     AND status IN ('claimed','submitting','running')
   ORDER BY attempt DESC LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT false, false, active_row.id, active_row.status,
      active_row.attempt, active_row.prediction_id, active_row.output_url;
    RETURN;
  END IF;

  -- Reuse a successful attempt without any new provider call.
  SELECT * INTO latest_row
    FROM public.animation_provider_jobs
   WHERE row_id = _row_id AND job_key = _job_key
     AND status = 'succeeded'
   ORDER BY attempt DESC LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT false, false, latest_row.id, latest_row.status,
      latest_row.attempt, latest_row.prediction_id, latest_row.output_url;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO attempts_total
    FROM public.animation_provider_jobs
   WHERE row_id = _row_id AND job_key = _job_key;

  IF attempts_total >= _max_attempts THEN
    SELECT * INTO latest_row
      FROM public.animation_provider_jobs
     WHERE row_id = _row_id AND job_key = _job_key
     ORDER BY attempt DESC LIMIT 1;
    RETURN QUERY SELECT false, true, latest_row.id, latest_row.status,
      latest_row.attempt, latest_row.prediction_id, latest_row.output_url;
    RETURN;
  END IF;

  INSERT INTO public.animation_provider_jobs
    (row_id, job_key, provider, model, status, attempt)
  VALUES
    (_row_id, _job_key, _provider, _model, 'claimed', attempts_total + 1)
  RETURNING * INTO new_row;

  RETURN QUERY SELECT true, false, new_row.id, new_row.status,
    new_row.attempt, new_row.prediction_id, new_row.output_url;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_provider_job(uuid, text, text, text, integer) TO service_role;

-- 3. Guarded update: applies patch fields ONLY when the row is not stopped
-- and not in a terminal status. Returns true when the patch was applied.
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
         error           = COALESCE(_patch->>'error', error),
         updated_at      = now()
   WHERE id = _row_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.guarded_update_animated(uuid, jsonb) TO service_role;

-- 4. Expire stale active rows with no in-flight provider jobs, so a new run
-- can start after a crash. Threshold in seconds; caller supplies value.
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
     WHERE ba.queue_status IN ('pending_confirmation','generating','stills_ready','animating','stitching')
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
