## Goal

When you click **Regenerate** on a faceless visual, open a dialog that shows the full locked plate-layout template (read-only) and exposes a small set of fields for the **botanical subject only**. Submitting regenerates that single image using the locked template + your subject overrides.

## What you'll see

```text
┌─────────────────────────────────────────────┐
│  Regenerate visual — Plate 02               │
├─────────────────────────────────────────────┤
│  Botanical subject (editable)               │
│  ┌─ Common name ──────────────────────────┐ │
│  │ Olive                                  │ │
│  ├─ Latin binomial ───────────────────────┤ │
│  │ Olea europaea                          │ │
│  ├─ Short description (3–4 lines) ────────┤ │
│  │ Evergreen tree, Oleaceae family,       │ │
│  │ native to the Mediterranean basin…     │ │
│  ├─ Hero specimen note (optional) ────────┤ │
│  │ single branch with leaves and ripe     │ │
│  │ drupes, slight desaturation            │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  ▸ Locked plate template (read-only)        │
│    [collapsible block showing the full      │
│     Architectural Botanical Study Plate     │
│     spec — top-left/right, center, lower,   │
│     footer, palette, constraints, etc.]     │
│                                             │
│             [ Cancel ]  [ Regenerate ]      │
└─────────────────────────────────────────────┘
```

The locked block is rendered from the same canonical template string used by the edge function — you can read it, copy it, but not edit it. Only the four subject fields write through.

## What counts as "the botanical subject"

The four editable fields map to the only parts of the plate that should change per plant:

1. **Common name** → top-left large serif (e.g. "Olive")
2. **Latin binomial** → top-left italic serif underneath (e.g. "Olea europaea")
3. **Short description** → 3-4 line muted serif under the binomial (evergreen/deciduous, family, native region, notable use)
4. **Hero specimen note** *(optional)* → center subject description (e.g. "single branch with ripe drupes")

Everything else — palette, lighting, typography rules, plate number, layout grid, Morphology section, footer, "BOTANICAL STUDY ARCHIVE MMXXIV", constraints — stays locked.

## Implementation

**Frontend**
- New `RegenerateVisualDialog.tsx` (shadcn `Dialog`). Opens from the existing Regenerate button in `ContentDisplay.tsx`. Pre-fills the four fields by parsing them out of the current `visual.prompt` (regex on the top-left block; fall back to empty).
- Add a `PLATE_TEMPLATE` constant in `src/lib/plateTemplate.ts` — the canonical locked spec, used both for the read-only preview and as the source of truth shipped to the edge function. Same string referenced by the edge function so there's one place to edit.
- Update `regenerateVisual` in `useBotanicalContent.ts` to accept a `subject: { commonName, binomial, description, specimenNote }` object alongside `moment`, and pass it to the edge function.

**Edge function (`regenerate-visual`)**
- Accept new optional `subject` field in the request body (Zod validated).
- If present, compose the final image prompt as: `PLATE_TEMPLATE` (locked) + injected subject block + the existing per-moment prompt's non-subject content. If absent, behave exactly as today.
- No model, bucket, or storage changes.

**Out of scope**
- No top-level/template editor UI.
- No changes to text generation, history, or other visuals.
- No new tables or secrets.
