## Goal
Use the bold title from the caption (Section 0, the first `**...**` line) as the displayed heading AND the title sent to TikTok — instead of the raw `plant_name`/`subject`. That way the TikTok draft auto-populates with the catchy headline you'd otherwise have to copy-paste.

## Changes (frontend-only, presentation layer)

### 1. New helper `src/lib/captionTitle.ts`
- `extractCaptionTitle(caption: string): string | null` — returns the first `**...**` line, stripped of asterisks and trimmed. Returns `null` if not found / empty.
- `getDisplayTitle(content): string` — returns `extractCaptionTitle(content.caption) ?? content.plant_name`. TikTok caps at 90 chars; helper trims to 90.

### 2. `src/components/ContentDisplay.tsx`
- Replace the `<h2>{content.plant_name}</h2>` (line 643) with `getDisplayTitle(content)`.
- In the TikTok send payload (line 606), change `title: content.plant_name` → `title: getDisplayTitle(content)`.
- `plant_name` still shown as a small subtitle/eyebrow above the heading so you don't lose the species reference (e.g. "Solanum lycopersicum").

### 3. No backend changes
- DB still stores `plant_name` and `caption` exactly as today.
- `post-tiktok-carousel` already accepts whatever `title` the client sends and slices to 90 chars — no edit needed.
- Works for both Botanical and Trends pages (Trends uses the same `ContentDisplay`).

### 4. Fallback behavior
- If caption has no bold title line (older saved rows, or AI returned malformed caption), fall back to `plant_name`. No breakage on history.

## Out of scope
- No regeneration of existing captions.
- No edge function / DB / image / prompt changes.
- No new schema column — derived at render time.

## Verification
- Open a freshly generated item: heading shows the bold caption headline; plant_name shows as a smaller eyebrow.
- Click "Send to TikTok" → confirm the TikTok draft title matches the bold headline (check via TikTok app or function logs).
- Open an old history item with no bold title → heading falls back to plant_name. No crash.
