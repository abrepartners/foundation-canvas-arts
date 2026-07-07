## Problem

Okra generation left 2 of 6 stills unfinished. The client polls `botanical_content.script_visuals` for up to 6 minutes, but if the edge function's background task dies (Replicate slowness / provider errors / edge runtime wall-clock on `waitUntil`), those slots stay stuck at `status: "generating"` or `"queued"` forever and the UI just spins.

We already ship a `generate-botanical-resume` edge function that finishes exactly these stuck visuals sequentially (fresh background, short poll windows). It just isn't wired to fire automatically — today the user would have to manually trigger it.

## Fix (frontend-only wiring + one small resume tweak)

**1. Auto-resume from the poller** — `src/hooks/useBotanicalContent.ts` → `pollForImages`
- After ~40s (20 polls at 2s) of the initial run, if any visual is still not `done`/`error`, invoke `generate-botanical-resume` with `{ content_id, image_provider }` and keep polling.
- Debounce so we call resume at most once every ~90s (avoid stacking background jobs on the same row).
- Extend the total poll ceiling to ~10 min so a resume cycle has time to finish.
- Pass the same `image_provider` used in the original `generate` call — thread it through so we don't hardcode `"openai"`.

**2. Small hardening in `generate-botanical-resume/index.ts`**
- Treat a visual with `status === "generating"` but no `started_at` as stuck immediately (today it only becomes stuck after 60s; a background death before the first `mergeVisual` write leaves `started_at` unset — fine — but a very fast re-poll should still catch it).
- Log which moments are being resumed for debugging.

**3. No changes** to still generation logic, prompts, DB schema, animated pipeline, TikTok send, or the concurrency/provider selection in `generate-botanical-content`. The main function stays as-is; resume covers its tail.

## Result

When a generation run leaves 1–2 stills stranded, the UI silently kicks the resume function ~40s in, sequentially retries the stuck moments, and the plates fill in without the user touching anything.

## Out of scope

- Rewriting the primary image-generation pipeline
- Changing image provider defaults or concurrency
- Animated video, TikTok send, caption/regeneration flows
