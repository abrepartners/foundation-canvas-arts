## Diagnosis

TikTok rejected the send with `picture_size_check_failed`. The stored botanical visuals are **1152×2048 JPEGs**, and TikTok photo carousels require the long side to be **≤ 1920px**. The HEAD fast-path I added last turn to avoid CPU timeouts was too permissive: it passed any JPEG under 8MB straight through without checking dimensions, so 2048px-tall images went to TikTok unchanged and got rejected.

## Fix

In `supabase/functions/post-tiktok-carousel/index.ts`, tighten `normalizeToTikTokJpeg`:

1. **Remove the blanket HEAD fast-path**. Keep only the "already normalized" fast-path (URL contains `/tiktok-jpeg/` and ends in `.jpg`), so re-sends of the same carousel still skip decode.
2. **Always decode + resize** first-time images so the long side ≤ 1920 and width ≤ 1080 for portrait — the existing resize math already handles this correctly, it just wasn't being reached.
3. Keep the persistent cache at `tiktok-jpeg/<original>-<w>x<h>-qN.jpg` so subsequent sends of the same content reuse the resized JPEG (fast, no CPU cost, no timeout risk).
4. Keep the 90s watchdog in `tiktok-send-status` as the safety net.

That's the only code change. Deploy `post-tiktok-carousel` afterward.

## Why this won't reintroduce the CPU timeout

The stall we saw earlier was a single job stuck at `normalizing` for hours — that was a cold path bug, not a systemic CPU issue. Normalizing 6 images sequentially with imagescript at 1080×1920 completes well under the Edge Function limit; after the first send, the cache path makes re-sends effectively free.

## Out of scope

- No change to TikTok API call, job schema, UI, or still-generation.
- Not touching the animated pipeline.
