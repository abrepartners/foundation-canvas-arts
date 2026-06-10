## What's happening

The edge function is the bottleneck. Three hardcoded limits prevent 6 plates from ever appearing:

1. **`MAX_VISUALS = 4`** — caps image generation at 4 plates even if the AI returns more.
2. **`MAX_EXECUTION_MS = 20000`** (20s) — kills image generation early. Images are made one-at-a-time, so usually only 3 complete before the timeout skip kicks in.
3. **AI prompt asks for "3–5 faceless visuals"** — so the model often returns 4 or 5, never 6.

That's why you see ~3 images, the 4th is empty/needs regenerate, and you never see 6.

## The fix

Make the generator actually produce all 6 plates and return them reliably, without hitting the edge-function timeout.

### 1. AI prompt (`generate-botanical-content/index.ts`)
- Change "Generate 3–5 faceless visuals" → **"Generate exactly 6 faceless visuals, one per moment: hook, dangle_1, rehook, dangle_2, verified_truth, close."**
- Update validation to require exactly 6 unique moments (reject and retry-friendly error otherwise).

### 2. Image generation strategy
- Remove `MAX_VISUALS` cap (process all 6).
- Remove the 20s timeout guard.
- Generate images in **parallel** (`Promise.all`) instead of sequentially — 6 in parallel completes in roughly the time of 1.
- Keep per-image try/catch so one failure doesn't kill the batch; failed plates come back with `image_url: null` and stay regenerable from the UI.

### 3. Background processing (safety net for slow runs)
Even parallelized, image generation can occasionally exceed the function wall-clock. To make this robust:

- The function inserts the row immediately with `script_visuals` containing the 6 prompts and `image_url: null` for each.
- Returns `202` to the client right away with `content_id` + the parsed script/visual prompts (so the UI renders all 6 slots immediately).
- Image generation runs in the background via `EdgeRuntime.waitUntil(...)`, writing image URLs back to the DB as each one finishes.
- The client subscribes to that row (Supabase realtime on `botanical_content`) or polls every 2s on `script_visuals` and updates the 6 plate slots as images arrive.

### 4. Frontend (`useBotanicalContent.ts` + `ContentDisplay.tsx`)
- After `generate()`, immediately show all 6 plate slots with the "Generate" placeholder for ones still pending.
- Subscribe to the row's updates (or poll) until every plate has an `image_url` or a final failure marker.
- Existing per-plate "Regenerate" button already covers any plate that ultimately fails.

## Result

- Every generation returns **6 plates** (one per script moment).
- All 6 image slots appear in the UI immediately; images stream in as they finish, usually within ~10–20s thanks to parallel generation.
- No more silent "only 3 generated" outcome — failures are explicit and per-plate regenerable.

## Technical notes

- Files touched: `supabase/functions/generate-botanical-content/index.ts`, `src/hooks/useBotanicalContent.ts`, `src/components/ContentDisplay.tsx` (minor — already handles pending plates).
- No schema change. `script_visuals` already stores the full array; we just update it incrementally.
- `regenerate-visual` function untouched.
