
## What I'm changing

Only the image generation prompt inside `supabase/functions/generate-botanical-content/index.ts`. No UI changes, no schema changes, no model change.

## Current vs new style

**Current prompt produces:** dark charcoal "museum study plate" with common name, Latin binomial, 3–4 line description, "PLATE — 0X" label, "Fig. 1 Branch" caption, "Morphology" header, A/B/C/D anatomical row, scale diagram, "BOTANICAL STUDY ARCHIVE / MMXXIV" footer, border frame.

**Your samples show:** warm cream/parchment paper, ONE photographic specimen, faint golden-ratio circles and thin construction lines with tiny circular tick markers, and almost no text — at most a small serif title or one or two whisper callouts.

## New "Warm Botanical Plate" style (what gets sent to the image model)

Every one of the 6 plates will be prompted with this locked style:

- Vertical 9:16, warm cream / parchment / bone paper background, soft natural grain, subtle vignette.
- ONE hero photographic botanical specimen, centered or rule-of-thirds, slightly desaturated, museum-grade, soft natural top-light.
- Faint golden-ratio circle overlay + thin geometric construction lines + small circular tick markers along the edges (like the sunflower references).
- Muted palette: warm bone, parchment, soft olive/sage, graphite line work. No dark mode, no charcoal background, no saturated colors.

### What is explicitly REMOVED from every prompt
- Common name label
- Latin binomial
- 3–4 line description block
- "PLATE — 0X" tag
- "Fig. 1 / Branch" caption
- "Morphology" header + A/B/C/D anatomical row
- Circular scale diagram with "Scale 1:2"
- "BOTANICAL STUDY ARCHIVE" / "MMXXIV" footer
- Border frame
- Any other text annotations, numeric measurements, or labels inside the image

The moment (hook, dangle_1, rehook, dangle_2, verified_truth, close) still only controls **which part of the plant** is shown — never the layout, never the text, never the typography. Style stays identical across all 6.

### Constraints kept
- No people, faces, hands, silhouettes, insects, desks, tools, jungles, icons, emojis, UI, bright colors.
- Zero-memory: every prompt restates the full warm-paper style from scratch.

## Files touched
- `supabase/functions/generate-botanical-content/index.ts` — replace the "Architectural Botanical Study Plate" block and the per-visual instructions with the new "Warm Botanical Plate" block above. Redeploy the function.

## Not touched
- Image model stays `google/gemini-2.5-flash-image-preview`.
- 6-plate parallel generation, polling, UI grid, history, regenerate-visual function — all unchanged.
- Script / caption / thumbnail / part2_hook UI sections in the app — unchanged (you said the "typing stuff" to strip is the text *inside the images*, per your Q1 answer).

Tell me to go and I'll switch to build mode and ship it.
