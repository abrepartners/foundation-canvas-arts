## Wire Kling v2.1 docs into the animated pipeline

### 1. Save the docs

Create `mem://reference/kling-v21` with the pasted spec — endpoint, param table (`model_name`, `image`, `prompt`, `negative_prompt`, `duration`, `mode`, `aspect_ratio`, `cfg_scale`, `image_tail`, `callback_url`, `external_task_id`), the 2500-char prompt limit, image constraints (≤10MB, 300px min, 1:2.5–2.5:1), and our field-adoption decisions. Add the entry to `mem://index.md`.

### 2. Rewrite the 6 motion prompts (`MOTION_BY_MOMENT`)

Restructure each to Kling's recommended pattern — **[Subject + action] + [Camera motion] + [Scene/atmosphere]** — ~60–90 words each, well under the 2500-char cap, no narration text, composition-lock preserved:

- Drop the repeated "Starting from the exact provided image…" preamble (Kling already anchors to `start_image`; rephrase as "Subject and framing remain identical to the reference frame").
- Use explicit camera verbs Kling recognizes (`static camera`, `slow push-in`, `slow horizontal truck`, `overhead lock`, `slow quarter-turn`) instead of percentage-based motion.
- Preserve each moment's choreography: hook = emergence, dangle_1 = macro push-in, rehook = parallax truck, dangle_2 = dissection separation, verified_truth = evidence-board settle, close = quarter-turn + spiral vignette.

### 3. Rewrite `negative_prompt`

Per Kling guidance (short, targeted; over-stuffing dilutes it). Focus on our observed failure modes:

```
text, letters, captions, subtitles, watermark, logo, borders,
morphing subject, species change, extra plants, human hands, people,
jump cut, whip pan, camera shake, rapid zoom, style change, cartoon,
oversaturation, blur, low quality
```

### 4. Tune Kling input params in `animated-animate-all/index.ts`

Update the `input` block (Replicate `kwaivgi/kling-v2.1` surfaces these fields):

```ts
input: {
  start_image: stillUrl,
  prompt,
  negative_prompt,
  duration: 10,             // 5 | 10 — keep 10 for our 60s cut
  aspect_ratio: "9:16",     // matches vertical stills; not set today
  cfg_scale: 0.5,           // 0–1; 0.5 balances prompt vs. image fidelity
  mode: "pro",              // std | pro — pro for higher motion quality
}
```

Fields we're **not** adopting this turn (documented in memory for later): `image_tail` (needs a matching end-frame still we don't generate), `camera_control` (collides with camera language in each prompt), `dynamic_masks` / `static_mask` (require per-shot authoring), `callback_url` (needs a public webhook), `external_task_id` (not needed — we track via Replicate prediction id).

### 5. Verify

- Build compiles.
- Add a single-line `console.log("kling input sample:", JSON.stringify(input))` on the first clip so the next real run is inspectable in edge logs. No generation triggered from this turn.

### Files touched

- `supabase/functions/animated-animate-all/index.ts` — prompts, negative prompt, input params, debug log.
- `mem://reference/kling-v21` — new memory file with the docs + field-adoption notes.
- `mem://index.md` — add the reference entry.

### Out of scope

- Still generation, stitching, UI, source picker.
- `camera_control` / `image_tail` / mask features (documented for later).
- Regenerating existing clips — changes apply to the next run only.
