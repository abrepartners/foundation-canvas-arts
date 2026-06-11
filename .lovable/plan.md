# Why your Hook & Dangle 1 look real but Re-hook went sketchy

Yes — a different *tool* generated them. The app has two image providers wired in:

- **Replicate → Flux 1.1 Pro** (photoreal, what you see in Hook + Dangle 1)
- **Lovable AI → Gemini 2.5 Flash Image Preview** (cheaper/faster, but tends to slide into sketch/diagram style on prompts that mention "architectural blueprint", "scientific annotations", "graphite construction lines" — exactly our plate style)

The Hook and Dangle 1 cards you like were rendered by **Flux 1.1 Pro**. The Re-hook card you circled was rendered by **Gemini**, which is why even with our new photoreal rules it still drifted into a flat illustration. Same prompt, different model, different aesthetic. No prompt rewrite will fully fix that — Gemini's image preview just doesn't render this style photoreal.

## The fix

Lock the entire pipeline (initial generation + every regenerate path) to **Replicate Flux 1.1 Pro** so every plate looks like Hook / Dangle 1.

### Changes

1. **`src/hooks/useBotanicalContent.ts`**
   - Default `imageProvider` state to `"replicate"` instead of `"lovable"`.
   - In `regenerateVisual`, `regenerateAllVisuals`, and the initial generate call, always send `image_provider: "replicate"` regardless of the toggle state. (Toggle stays in the UI for debugging but no longer affects output.)

2. **`supabase/functions/regenerate-visual/index.ts`**
   - Flip the provider resolution so it defaults to `"replicate"` unless explicitly overridden with `image_provider === "lovable"`. Same line, inverted condition.

3. **`supabase/functions/generate-botanical-content/index.ts`**
   - Same flip: default to `"replicate"` unless `image_provider === "lovable"` is explicitly passed.

4. **Preflight guard**: if `REPLICATE_API_KEY` is missing, both edge functions return a clear error instead of silently falling back to Gemini. (Today they fall back, which is how Re-hook ended up sketchy.)

5. **Backfill the old cards**: no schema change needed. You just hit **Regenerate** on Re-hook (and any other moment that looks off) and it'll re-render through Flux with the photoreal prompt rules we already added. Previous versions stay in the history strip so you can compare or revert.

### Not changing

- The prompt content (PLATE_STYLE_BLOCK, MOMENT_BRIEFS, COMPOSITION_VARIETY_RULE) — already updated last turn.
- UI, regenerate buttons, history strip, copy buttons, script display, polling, retries, DB schema.
- Replicate rate-limit backoff logic (stays as-is — 6/min cap still applies).

### Verification

- Regenerate Re-hook → confirm photoreal carnation with diagonal composition.
- Regenerate Verified Truth and Dangle 2 → confirm photoreal A/B/C/D parts and cross-sections.
- Generate a brand-new plant from scratch → confirm all 6 plates render via Flux.
- Confirm the history strip still shows the prior (Gemini) versions so you can compare side-by-side.

## Open question

Do you want me to **remove the Lovable/Gemini toggle from the UI entirely**, or **keep it as a hidden debug option** (default Replicate, but you can flip it if Replicate is down or out of credits)? I'd recommend keeping it hidden-but-available — costs nothing and gives you a fallback.