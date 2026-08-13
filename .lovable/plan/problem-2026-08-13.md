
## Problem

On the content package page, the 6 faceless-visual tiles show three different, contradictory states ("Queued" / "Generating…" / "Working…") depending on whether the backend has written status, the local button was clicked, or nothing has happened yet. There's also no way to see *why* a still has been spinning for minutes, and the background poller keeps invoking `generate-botanical-resume` every ~90s, which spins up fresh Replicate predictions — the user is worried this silently re-bills.

## Fix (frontend + poller only, no new backend logic)

### 1. One status vocabulary everywhere

Collapse the tile status into a single 4-state model that the badge, the empty-tile CTA, and the overlay all read from:

| State | When | Badge | Tile CTA |
|---|---|---|---|
| Queued | slot exists, no image, `status` is undefined/`queued`, no `started_at` | grey "Queued" | disabled "Waiting…" |
| Generating | `status === "generating"` OR local click in flight | pulsing "Generating · 42s" (live elapsed from `started_at`) | disabled spinner "Generating…" |
| Ready | `image_url` present | no badge | Regenerate icon |
| Failed | `status === "error"` or `error` set | red "Failed" | red "Retry" with error tooltip |

Remove the "Working…" string entirely — the button label always mirrors the badge.

### 2. Per-tile visibility

- Show live elapsed time under Generating tiles (ticks every 1s in the hook, driven by a single `useEffect` timer, not per-tile).
- When elapsed > 90s, add a subtle "Taking longer than usual" line under the badge.
- When `status === "error"`, surface the error message inline (already partly there — make it always visible, not just when there's no image).

### 3. Top-of-section summary strip

Above the 6-tile grid, replace the current one-line counter with a compact strip:
- `X / 6 ready · Y generating · Z failed`
- Overall elapsed since generation started (from oldest `started_at` in the batch)
- A single "Retry stuck" button (only enabled when there are failed or stalled >2min slots, and only after auto-resume budget is exhausted — see #4).

### 4. Cap the auto-resume so Replicate isn't re-billed forever

`pollForImages` in `src/hooks/useBotanicalContent.ts` currently re-invokes `generate-botanical-resume` every 90s indefinitely while the tab is open. Change it to:

- Max **2** auto-resume invocations per generation (was: unbounded).
- Only auto-resume slots that are `error` OR `generating` with `started_at` older than 2 min. Slots that are freshly generating are left alone.
- After the 2nd auto-resume, stop polling for resumes and enable the manual "Retry stuck" button in the summary strip. UI text: "Auto-retry paused to avoid extra Replicate charges. Click to retry manually."
- Stop the poll loop entirely when everything is Ready or Failed (already the case) OR when the tab is hidden (`document.visibilityState === "hidden"`) and resume when it comes back — avoids background billing while user is away.

### 5. Files touched

- `src/components/ContentDisplay.tsx` — new status-vocabulary logic, live elapsed timer, summary strip, "Retry stuck" button, remove "Working…"/"Pending…" strings.
- `src/hooks/useBotanicalContent.ts` — cap `pollForImages` auto-resume to 2, add visibility-hidden pause, expose `retryStuck(imageProvider)` so the summary strip button can trigger a manual resume.
- `src/pages/Index.tsx` — pass `retryStuck` through to `ContentDisplay`.

No edge function or DB changes. No change to the Animated page (its stepper already has this pattern).

## Out of scope

- Kling clip status on the Animated page — its stepper already surfaces per-clip progress and cost.
- Cancelling in-flight Replicate predictions server-side (Replicate's connector-gateway doesn't expose cancel from our current pipeline; auto-resume cap is the practical guard).
