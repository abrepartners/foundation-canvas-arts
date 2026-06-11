## Goal

The locked Architectural Botanical Study Plate style says "Realistic botanical or organic specimen illustration," but the per-moment composition briefs for Re-hook, Dangle 2, and Verified Truth are pushing the model into pure graphite-sketch / line-drawing territory (see the circled Re-hook in the screenshot — it lost the photoreal carnation entirely).

Fix: tighten the style block and rewrite those three moment briefs so the *subject itself* must always be rendered photo-realistically. Diagonals, cross-sections, callouts, and evidence panels are layered ON TOP of realistic specimen art — never replacing it with a sketch.

No changes to: UI, JSON contract, DB schema, Replicate routing, regenerate buttons, history/versioning, polling, retries, provider toggle, copy-button cleanup, script display.

---

## Changes

### 1. Strengthen the locked style block (3 files, identical wording)

Add an explicit, non-negotiable rendering rule to `PLATE_STYLE_BLOCK`:

```
SPECIMEN RENDERING (NON-NEGOTIABLE): The botanical subject itself must always be rendered as a photo-realistic, museum-grade botanical illustration with true-to-life petal texture, depth, soft shadow, and dimensional form. Never a flat line drawing, never a graphite sketch, never a wireframe, never a pure blueprint outline of the subject. Blueprint construction lines, measurement brackets, callouts, leader lines, and annotations are layered AROUND and ON TOP of the realistic specimen — they never replace it.
```

Add to the AVOID list:
`flat sketch renderings of the subject, pencil-only drawings of the subject, wireframe-only specimens, line-art-only flowers or leaves`

### 2. Rewrite the three drifting moment briefs

**Re-hook** — keep diagonal, kill the sketch:
> MOMENT — RE-HOOK (SHOT TYPE: DIAGONAL HERO WITH HEAVY BLUEPRINT OVERLAY): The same photo-realistic specimen as the hook, rendered at full photoreal fidelity, but composed on a strong diagonal axis cutting across the frame at larger scale, with deeper shadow, higher contrast, and heavier blueprint measurement brackets, construction lines, and figure labels overlaid around it. The subject itself must remain a realistic botanical illustration — NOT a sketch, NOT a line drawing, NOT a graphite outline. Only the composition angle and overlay density change.

**Dangle 2** — keep cross-sections, but render them photoreal:
> MOMENT — DANGLE 2 (SHOT TYPE: PHOTOREAL SCIENTIFIC BREAKDOWN): Multiple inset panels showing cross sections, internal anatomy, and magnified tissue — each panel rendered as a photo-realistic botanical illustration with true texture and depth, not as line drawings. Detail circles with leader lines and numeric markers connect the panels. Investigative and technical feel comes from the panel layout and annotations, not from flattening the specimen into a sketch.

**Verified Truth** — keep evidence layout, lock photoreal parts:
> MOMENT — VERIFIED TRUTH (SHOT TYPE: PHOTOREAL EVIDENCE BOARD): A structured A, B, C, D row or grouped panels of separated specimen parts (petal, stem segment, bud, leaf, seed, etc.), each part rendered as a photo-realistic museum-grade botanical illustration. Figure callouts (Fig. 1, Fig. 2), measurement references, and labels sit beside the realistic parts. Most credible, research-based plate. The parts themselves are never sketches or outlines.

### 3. Reinforce the variety rule

Update `COMPOSITION_VARIETY_RULE`:
> The six images MUST NOT look like six variations of the same full botanical poster. They must share the exact same visual style (paper, palette, typography, blueprint language, AND photoreal specimen rendering), but each moment must have a clearly different shot type and composition as specified in its moment brief. Composition variety must NEVER be achieved by switching the subject from photoreal to sketch — the specimen is always photoreal across all six plates.

---

## Files touched (mirrored constants — same edit in all three)

- `src/lib/architecturalPlate.ts`
- `supabase/functions/regenerate-visual/index.ts`
- `supabase/functions/generate-botanical-content/index.ts`

No other files change.

---

## Verification after build

1. Regenerate the Re-hook on the current carnation — confirm the flower is photoreal, just diagonal with heavier brackets.
2. Regenerate Dangle 2 — cross-section panels render as realistic illustrations, not pencil sketches.
3. Regenerate Verified Truth — A/B/C/D parts are realistic specimen art, not outlines.
4. Confirm Hook, Dangle 1, and Close are unchanged in look.
5. Confirm script copy cleanup, history strip, one-click regenerate, and "Regenerate all" still behave exactly as before.
