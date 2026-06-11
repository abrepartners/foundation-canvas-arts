## Goal

Three connected upgrades:

1. **One-click regenerate** — no dialog, no text fields. Pressing Regenerate immediately re-runs the image using the current locked Architectural Botanical Study Plate style + the correct moment brief + the plant already on the content.
2. **Refresh old content with the new style** — give old generations a "Regenerate all 6 with new style" button so previously generated plates (made under the old style) can be brought up to current standards.
3. **Per-slot version history** — keep previous generations for each moment so you can flip back to an earlier render if the new one is worse.

No changes to: JSON contract, Replicate routing, polling, retries, provider toggle, copy-button cleanup, script display, DB table schema (we'll reuse the existing `script_visuals` JSON column).

---

## 1. One-click regenerate (no dialog)

**`src/components/ContentDisplay.tsx`**
- Remove the `RegenerateVisualDialog` open/close flow. The Regenerate button calls `onRegenerate(visual.moment)` directly.
- Show a spinner overlay on that one tile while it runs (already wired).

**`src/hooks/useBotanicalContent.ts`**
- `regenerateVisual(moment)` — drop the `subject` and `prompt` arguments from the call site. Pass only `{ content_id, moment, image_provider }` to the edge function. The edge function already knows how to rebuild the locked prompt from the stored `plant_name`.

**`supabase/functions/regenerate-visual/index.ts`**
- Accept `{ content_id, moment, image_provider }`. Remove the `subject` / `prompt` inputs (keep them optional for backward compat but ignore).
- Look up the row, read `plant_name`, call `buildPlatePrompt(plant_name, moment)` — always uses the current in-function style block + moment brief. This is what makes the regenerate "use the new updated style" automatically.

**`src/components/RegenerateVisualDialog.tsx`** — delete (no longer used).
**`src/lib/plateTemplate.ts`** — keep the file; just remove the `PlateSubject` re-export usage from the dialog. (No other consumers.)

---

## 2. "Regenerate all with new style" for old content

**`src/components/ContentDisplay.tsx`**
- Add a single button in the Faceless Visuals header: **"Regenerate all with new style"**. Confirms once, then loops the 6 moments sequentially (sequential avoids Replicate 429 storms — matches the existing batch generator's pacing).
- Per-tile state already shows spinner while each runs.

**`src/hooks/useBotanicalContent.ts`**
- Add `regenerateAllVisuals()` helper that awaits `regenerateVisual(moment)` for each of the 6 moments in order.

No edge function changes needed — it just reuses the new one-click path above.

---

## 3. Per-slot version history

We extend the in-JSON shape of each visual without changing the DB column. Today each entry is:

```
{ moment, prompt, image_url, error }
```

New shape (backward compatible — old entries are read as having no history):

```
{
  moment,
  prompt,            // current prompt
  image_url,         // current active image (what UI shows)
  error,
  history: [         // newest first, capped at 5
    { image_url, prompt, created_at }
  ]
}
```

**`supabase/functions/regenerate-visual/index.ts`**
- Before overwriting, push the existing `{image_url, prompt, created_at: now}` onto `history` (if `image_url` was set). Cap at 5. Then set the new `image_url` and `prompt` as current.
- Storage: upload the new file to a versioned path `${content_id}/${moment}/${timestamp}.png` instead of overwriting `${moment}.png`. This guarantees old URLs in `history` keep working. (Existing flat `${moment}.png` files remain readable for legacy rows.)

**`src/hooks/useBotanicalContent.ts`**
- Extend the `FacelessVisual` type with optional `history?: { image_url: string; prompt: string; created_at: string }[]`.
- `regenerateVisual` response now also returns the updated visual entry (including history); merge it into local state.

**`src/components/ContentDisplay.tsx`**
- On each tile, when `history.length > 0`, show a small "History (N)" chevron under the image.
- Expanding shows a horizontal strip of thumbnails. Clicking one shows a **"Use this version"** action that calls a new edge function action (or extends the existing one) with `{content_id, moment, action: "restore", image_url, prompt}` to swap current ↔ that history entry. The currently-active version always moves into history on swap so nothing is lost.

---

## Confirmations

- Six moments unchanged.
- Replicate routing, polling, retry logic untouched.
- Provider toggle untouched.
- Script copy-cleanup untouched.
- DB schema unchanged (only JSON shape inside `script_visuals` is extended, and the change is backward compatible).
- The dynamic subject still flows in — for new one-click regen it's read from `plant_name` on the stored row; for fresh generations nothing changes.
- Each generated prompt is still fully standalone (built from `PLATE_STYLE_BLOCK` + moment brief + subject + variety rule + closing line).

---

## Files touched

- `supabase/functions/regenerate-visual/index.ts` — accept minimal payload, rebuild prompt from `plant_name`, write versioned storage path, append to `history`, add `restore` action.
- `src/hooks/useBotanicalContent.ts` — slim `regenerateVisual` signature, add `regenerateAllVisuals` and `restoreVisualVersion`, extend type.
- `src/components/ContentDisplay.tsx` — direct-click regenerate, "Regenerate all" button, history strip with "Use this version".
- `src/components/RegenerateVisualDialog.tsx` — delete.
- `src/pages/Index.tsx` — wire the two new hook methods through.
