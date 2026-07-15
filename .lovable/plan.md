## Problem

Every edge function call from the preview fails with "Failed to send a request to the Edge Function" / "Failed to fetch". Network logs show the browser origin is:

`https://2dc683a5-50ba-401b-94db-7cc9b6c8ca80.lovableproject.com`

But `supabase/functions/_shared/cors.ts` only allows:
- `https://foundation-canvas-arts.lovable.app`
- `https://id-preview--...lovable.app`
- `http://localhost:8080`, `http://localhost:5173`

The `.lovableproject.com` preview origin isn't in the allowlist, so the CORS preflight is rejected and the browser blocks the POST — the request never reaches the function (that's why edge logs are empty).

## Fix

Update `supabase/functions/_shared/cors.ts` to also allow the `lovableproject.com` preview origin.

Two options:
1. Add the exact hostname `https://2dc683a5-50ba-401b-94db-7cc9b6c8ca80.lovableproject.com` to the `ALLOWED_ORIGINS` set.
2. Switch to a regex/suffix check that allows any `*.lovableproject.com` and `*.lovable.app` origin (more robust — preview URLs can change).

Recommend option 2: match origins whose hostname ends in `.lovable.app`, `.lovableproject.com`, or is `localhost` on any port. This survives future preview URL changes without needing another patch.

No other files change. This affects every edge function since they all import `corsHeadersFor` from this shared module, so the fix unblocks generation, TikTok send, MCP, animated pipeline, etc. in one edit.
