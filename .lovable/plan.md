## Answering your questions

**1. Is your image prompt being used per image via Replicate?**
Yes. The AI generates 6 unique prompts (one per script moment: hook, dangle_1, rehook, dangle_2, verified_truth, close) following your Botanical Study Plates style system. Each prompt is sent verbatim to Replicate FLUX 1.1 Pro at 9:16. No prompt sharing, no memory between plates.

**2. Why are 5 of 6 images failing?**
Edge function logs show Replicate is returning **HTTP 429 rate limit**:
> "Your rate limit for creating predictions is reduced to **6 requests per minute with a burst of 1** while you have less than $5.00 in credit."

We're firing all 6 plates in parallel → only 1 succeeds, the other 5 fail instantly. This is a Replicate account-level throttle, not a code bug. Topping the Replicate account above $5 lifts it; until then, we must serialize.

**3. Regenerate button.**
A regenerate button already exists per image — it appears on hover for completed images and as a "Generate" button on empty slots. But because the failed plates currently have *no* slot state at all (they were never marked as "failed"), nothing shows. We'll surface a visible Regenerate button on every plate regardless of state.

---

## Plan

### A. Throttle Replicate to respect the burst limit
In both `generate-botanical-content` and `regenerate-visual`:
- When `image_provider === "replicate"`: run the 6 plates **sequentially** with a ~11s gap between starts (safe under 6/min + burst=1).
- On 429: read `retry_after` from Replicate's response and wait that long, then retry up to 2 times.
- Lovable provider keeps current parallel behavior (no rate limit issue there).

### B. Mark failed plates so the UI can recover
- When a plate errors, write the visual back to `script_visuals` with `image_url: null` and `error: "<short message>"` instead of leaving it blank.
- Frontend polling already updates state from this column, so failures will render immediately.

### C. Always-visible per-image Regenerate button
In `src/components/ContentDisplay.tsx`:
- Show a small "Regenerate" button under every plate (not only hover), in addition to the hover overlay on successful images.
- If `visual.error` exists, render a subtle error chip + a prominent "Retry" button on the empty slot.
- Reuses existing `RegenerateVisualDialog` and the already-wired `regenerateVisual(moment, prompt, subject, imageProvider)` path.

### D. No schema changes
`script_visuals` is already a JSON blob; the optional `error` field is additive.

---

## Files to edit
- `supabase/functions/generate-botanical-content/index.ts` — sequential loop + 429 backoff + persist errors
- `supabase/functions/regenerate-visual/index.ts` — same 429 backoff
- `src/hooks/useBotanicalContent.ts` — extend `FacelessVisual` with optional `error`
- `src/components/ContentDisplay.tsx` — always-visible regenerate button + error state

## Note on cost
Sequential Replicate at 11s/plate ≈ ~70s for 6 images (plus model runtime, so realistically 2–3 min total). If you top up Replicate past $5, the throttle disappears and we can switch back to parallel for ~20s total — say the word and I'll add a toggle.
