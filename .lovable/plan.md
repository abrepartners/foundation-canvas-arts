## Diagnosis

Latest job (`be6614df…`) died at `phase: normalizing` with "Background task stalled before contacting TikTok" — the 90s watchdog fired. The previous job (`b578a832…`) is the old `picture_size_check_failed` from before the fast-path fix.

Root cause: with the HEAD fast-path removed, every send now decodes **6 × 1152×2048 PNG/JPEG** files with `imagescript` (pure JS, single-threaded) inside one edge function invocation. That blows past the CPU budget and the job never reaches TikTok — even though our source images are only barely over the 1920px limit.

## Fix

Stop doing pixel work inside the edge function. Supabase Storage already ships an image transformation endpoint that resizes server-side:

```
${SUPABASE_URL}/storage/v1/render/image/public/<bucket>/<path>?width=1080&height=1920&resize=contain&format=origin&quality=85
```

Rewrite `normalizeToTikTokJpeg` in `supabase/functions/post-tiktok-carousel/index.ts`:

1. Keep the "already normalized" fast-path (`/tiktok-jpeg/…jpg`).
2. For every other URL, derive the bucket path from the public URL, then `fetch` the transform endpoint with `width=1080&height=1920&resize=contain&quality=85` and `format=origin` forced to JPEG via `&format=jpeg` (or fall back to setting `Accept: image/jpeg`).
3. Upload the returned bytes to `tiktok-jpeg/<origPath>-1080x1920-q85.jpg` (upsert) — same cache key shape as today, so re-sends short-circuit.
4. Return the public URL of that cached JPEG to feed into TikTok's `photo_images`.
5. Remove the `imagescript` import entirely — no more in-process decode.

Sequential fetch of 6 already-resized JPEGs from Supabase is I/O bound and completes in a couple of seconds, well under any CPU cap. The watchdog stays as a safety net.

## Verification

After deploy: press "Send to TikTok" on a pending item, watch `tiktok_send_jobs` progress `queued → normalizing → initializing → publish_id_received`, then confirm the draft lands in TikTok inbox.

## Out of scope

- No change to still generation, animated pipeline, UI, job schema, or TikTok API payload shape.
- Not touching the 90s watchdog logic.
