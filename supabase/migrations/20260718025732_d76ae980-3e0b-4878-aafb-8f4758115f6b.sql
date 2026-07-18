
REVOKE EXECUTE ON FUNCTION public.consume_animation_retry(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_provider_job(uuid, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guarded_update_animated(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_stale_active_animated(integer) FROM PUBLIC, anon, authenticated;
