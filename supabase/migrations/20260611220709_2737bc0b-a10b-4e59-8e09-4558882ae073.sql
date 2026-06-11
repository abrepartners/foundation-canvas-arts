
-- Lock down storage write/update/delete on botanical-faceless-visuals to service_role only.
DROP POLICY IF EXISTS "Service role can upload faceless visuals" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update faceless visuals" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete faceless visuals" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for faceless visuals" ON storage.objects;

CREATE POLICY "Service role uploads faceless visuals"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (bucket_id = 'botanical-faceless-visuals');

CREATE POLICY "Service role updates faceless visuals"
ON storage.objects FOR UPDATE TO service_role
USING (bucket_id = 'botanical-faceless-visuals');

CREATE POLICY "Service role deletes faceless visuals"
ON storage.objects FOR DELETE TO service_role
USING (bucket_id = 'botanical-faceless-visuals');

-- Files remain publicly accessible via the bucket's public flag + CDN public URLs;
-- removing the SELECT-on-objects policy prevents anonymous *listing* of all files.

-- Document tiktok_tokens intent: deny all client access; only service_role (edge functions) may use it.
REVOKE ALL ON public.tiktok_tokens FROM anon, authenticated;
GRANT ALL ON public.tiktok_tokens TO service_role;

CREATE POLICY "Deny all client access to tiktok_tokens"
ON public.tiktok_tokens FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);
