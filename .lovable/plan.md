## What we're actually running (not Seedance)

Nothing in this codebase touches `bytedance/seedance-1-pro` — grep confirms zero references. The `/animated` pipeline uses:

| Stage | Model | File | Approx. list price | Per finished job |
|---|---|---|---|---|
| 6 hero stills | `openai/gpt-image-2` (high) | `regenerate-visual` | ~$0.19 / image | ~$1.14 |
| 6 clips, 10s each, **mode: "pro"**, 9:16 | `kwaivgi/kling-v2.1` | `animated-animate-all` | ~$0.28 / sec | ~$16.80 |
| Final stitch | `fofr/video-concat` | `animated-stitch` | trivial | ~$0.02 |
| **Total** | | | | **≈ $18 / video** |

So the Seedance line on your Replicate bill came from somewhere else on that Replicate account (playground, another app, a manual test). Worth checking `replicate.com/account/billing` → usage log to find which project/token generated it.

That said — we still want per-job cost tracking so this can never be a mystery again. Here's that piece.

## Build: per-job cost tracking

Goal: every animated job records what it cost, visible in the UI. No design or generation changes.

### 1. Schema (migration)

Add to `botanical_animated`:
- `cost_breakdown jsonb default '{}'::jsonb` — `{ stills, clips, stitch, total_usd }`
- `cost_usd numeric(10,4)` — denormalized total for sorting/summing

Keep existing RLS. Edge functions write via service role, so no new grants needed.

### 2. Pricing constants

New `supabase/functions/_shared/pricing.ts` — single source of truth so a price change is one edit:

```ts
export const PRICING = {
  "openai/gpt-image-2":   { unit_usd: 0.19 },
  "kwaivgi/kling-v2.1":   { std_usd_per_sec: 0.08, pro_usd_per_sec: 0.28 },
  "fofr/video-concat":    { flat_usd: 0.02 },
} as const;
```

### 3. Write cost as each stage finishes

Small helper `_shared/cost.ts` → `mergeCost(supabase, row_id, patch)` does a read-modify-write JSON merge and recomputes `cost_usd` so stages don't clobber each other.

- `regenerate-visual` (animated path, `image_provider: "openai"`): on success, merge `cost_breakdown.stills = { model, count: 6, unit_usd, total_usd: 1.14 }` onto the parent `botanical_animated` row (row_id already threaded).
- `animated-animate-all`: after all 6 clips succeed, merge `cost_breakdown.clips = { model: "kwaivgi/kling-v2.1", mode: "pro", seconds: 60, unit_usd_per_sec, total_usd: 16.80 }`.
- `animated-stitch`: on success, merge `cost_breakdown.stitch = { model, total_usd: 0.02 }`; helper recomputes `cost_usd`.

### 4. UI surface (read-only, no restyle)

- `src/pages/Animated.tsx` — small line under progress steps: `Estimated cost: $18.02` once `cost_usd` populates.
- `src/pages/Queue.tsx` — add a "Cost" column for animated rows + footer total for visible rows.
- `src/components/HistorySidebar.tsx` — append `· $18.02` after the plant name when `cost_usd` is set.

All read directly from the row; no new edge function.

### 5. Not in scope (flagging only)

- Switching Kling `mode: "pro"` → `"std"` (~1/3.5 the cost, ~$4.80/job) or moving to `wan-video/wan-2.2-i2v-fast` — you said don't change generation logic. Say the word and it's a one-line change.
- Cancelling in-flight Replicate predictions.
- Backfilling `cost_usd` on the 2 existing rows — trivial one-shot if you want it.

### Files touched

- new: `supabase/migrations/<ts>_add_cost_tracking.sql`, `supabase/functions/_shared/pricing.ts`, `supabase/functions/_shared/cost.ts`
- edit: `supabase/functions/regenerate-visual/index.ts`, `supabase/functions/animated-animate-all/index.ts`, `supabase/functions/animated-stitch/index.ts`
- edit UI: `src/pages/Animated.tsx`, `src/pages/Queue.tsx`, `src/components/HistorySidebar.tsx`
