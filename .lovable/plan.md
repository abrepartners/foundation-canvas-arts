## Goal

Get Pomegranate moving again right now, and make stuck stills impossible going forward.

## Root cause recap

1. The OpenAI gpt-image-2 fetch in `generate-botanical-content` has no timeout — when the API hangs, the visual is stuck at `status: "generating"` forever.
2. The edge runtime kills `EdgeRuntime.waitUntil` after ~150s, so both the image generator AND the `animated-start` 12-minute poll get reaped mid-flight.

## Changes

### 1. `supabase/functions/generate-botanical-content/index.ts` — add timeouts + auto-retry

- Wrap the OpenAI/Replicate fetch in `generateImageBytes` with an `AbortController` (90s timeout for OpenAI, 120s for Replicate). On timeout, throw — which propagates to `mergeVisual(..., { status: "error" })` instead of leaving "generating" forever.
- In `generateOne`, on error retry once automatically (so a single hung request doesn't kill a slot).

### 2. New endpoint: `supabase/functions/generate-botanical-resume/index.ts`

Small function that takes `{ content_id }`, reads `script_visuals`, and re-generates any visual whose status is `error` or `generating` (treating "generating" as stale if the row's `updated_at` is more than 3 minutes old). Reuses the same `generateImageBytes` + storage upload code path. Uses `EdgeRuntime.waitUntil` for background work but each call is bounded (≤ 2 stills × ~60s).

### 3. `supabase/functions/animated-start/index.ts` — chunked self-chaining poller

Replace the single 12-minute polling loop with a bounded one:

- Poll for up to **90 seconds** in this invocation (30 iterations × 3s).
- Each iteration, also call the new `generate-botanical-resume` if it sees any visual stuck > 60s.
- If stills aren't done at 90s, self-invoke `animated-start-resume` with `{ row_id }` and return. The next instance picks up exactly where this one left off. This keeps every instance well within the runtime's lifetime budget.

(Or, simpler: extract the poll loop into a small `animated-stills-poll` function the start function chains into. Same effect, cleaner separation.)

### 4. Animated.tsx — small UI affordance

Add a "Retry stuck stills" button visible when `queue_status === "generating"` AND `progress.steps.find(s => s.key === "stills").detail` shows < 6/6 AND the row's `updated_at` is older than 2 minutes. Clicking it invokes `generate-botanical-resume` for the source content id and re-invokes `animated-start-resume` for the animated row.

### 5. One-time fix for the current Pomegranate row

After the new functions deploy, invoke `generate-botanical-resume` with `content_id = 1488150e-afb7-4f69-a29f-6647ba45d8aa`, then re-invoke `animated-start-resume` with `row_id = bcb95246-12ef-4b64-92cb-b4bceb21025a`. This finishes the 2 missing stills and resumes the pipeline straight through to clips → stitch.

(Same recovery applies to the older stuck Fig row from 05:23 if you want it salvaged — otherwise it stays in error state and can be deleted.)

## Technical details

- AbortController pattern:
  ```ts
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 90_000);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    ...
  } finally { clearTimeout(t); }
  ```
- "Stale generating" check: compare `now - updated_at > 60_000`. Requires either using `updated_at` (already on the row) or stamping a per-visual `started_at` inside script_visuals. Per-visual is more precise — add it in `mergeVisual` when transitioning to `"generating"`.
- Self-chaining via `supabase.functions.invoke("animated-start-resume", { body: { row_id } })` from inside `waitUntil` right before returning. Fire-and-forget; don't await.

## Out of scope

- No schema changes to `botanical_content` or `botanical_animated` — all state already lives in `script_visuals` JSON and `progress` JSON.
- No change to clip animation or stitch logic; those already use the same waitUntil pattern but each clip is bounded and clips have their own retry path.
