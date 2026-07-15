## The bug

`supabase/functions/post-tiktok-carousel/index.ts` defines a module-level `json()` helper (lines 91–96) that references a `corsHeaders` variable that only exists inside the request handler (line 101). Every response path — success, validation error, and catch — goes through `json()`, so the function throws `ReferenceError: corsHeaders is not defined` before it can reply. The browser sees "Failed to send a request to the Edge Function" and the UI shows "TikTok rejected the carousel."

This is a regression from the earlier CORS lockdown pass that converted a module-level `corsHeaders` constant into the per-request `corsHeadersFor(req)` call but did not update the helper.

## Fix

1. Move the `json()` helper inside the `Deno.serve` handler (after `const corsHeaders = corsHeadersFor(req)`), so it closes over the per-request headers. No behavior change to any response body or status.
2. Leave everything else (auth guard, background job, TikTok payload, polling) untouched — those all work; they just never got to run because the response helper crashed first.

## Verification

- Rebuild typechecks.
- From the Kiwi post, click **Send to TikTok** and confirm the progress bar advances past "Initializing" to "Uploading to TikTok" and the job row in `tiktok_send_jobs` moves through `queued → normalizing → initializing → publish_id_received`.
- If TikTok itself rejects the carousel after that, the real provider error will now surface in the banner instead of the generic edge-function failure.

## Files touched

- `supabase/functions/post-tiktok-carousel/index.ts` (single small edit)
