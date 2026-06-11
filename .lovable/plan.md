## Goal

Replace the current short `caption` with a long-form, SEO-structured educational caption in the exact format you specified. This caption is what already gets sent to TikTok as the post description, so the same change powers both UI display and TikTok/Instagram drafts.

## Where the caption is generated

Both content generators ask the model for a `caption` field:

- `supabase/functions/generate-botanical-content/index.ts` (line ~283)
- `supabase/functions/generate-trend-content/index.ts` (line ~273)

It's then displayed by `ContentDisplay.tsx` (Caption card) and sent as `description` in `handleSendTikTok`. Storage/types already hold it as plain text, so no schema or UI changes are needed — just a richer string.

## Changes

### 1. `supabase/functions/generate-botanical-content/index.ts`

Expand the caption instructions in the system prompt so the model produces the SEO caption:

- Add a dedicated "CAPTION REQUIREMENTS" section before the JSON contract.
- Specify: 175–300 words, structured as Hook → why-it-sounds-wrong → scientific clarification → plain-language fact → "This is why:" with 4 bullet lines (using `– ` em-dash bullets) → contrast common vs botanical → series framing → the literal brand line:
  ```
  My brother studies plants.
  I verify the facts.
  ```
  → "More verified botanical explanations coming soon." → `Topics covered:` block with 6 searchable phrases (one per line, no bullets) → 5 relevant hashtags (one per line, `#` prefix).
- Tone rules: calm, confident, educational, no slang, no hype, no ads, no emojis.
- SEO keyword guidance: each caption must naturally weave in 2–3 of these phrase patterns: *botanical classification, plant structure, seeds vs fruits, fruit definitions, plant reproduction, why [topic] is classified this way, how botanists define [topic], common names vs scientific definitions, plant anatomy explained.* The `Topics covered:` block must include topic-specific variants of the same families.
- "Do not" list mirrored from your spec (no generic short caption, no witty-only, no ad voice, no overused hashtags, no incorrect science).
- Keep the JSON contract identical (`"caption": "string"`), but add a comment-style line in the prompt clarifying the caption must contain real newlines (`\n`) so the structure survives JSON encoding.

### 2. `supabase/functions/generate-trend-content/index.ts`

Apply the same caption requirements block. Adapt the SEO keyword families to the trending topic where applicable (still botanical-leaning, since the trends page reuses the verification voice).

### 3. Length safety

TikTok's description cap is 4000 chars; ~300 words ≈ 2000 chars, so we're well within limits. No truncation logic needed. The existing `.slice(0, 4000)` in `post-tiktok-carousel` stays as a safety net.

### 4. No code changes needed in:

- `ContentDisplay.tsx` — the Caption card already renders `whitespace-pre-wrap`-friendly content via `<p>`. (Quick verify during build that line breaks render; if not, swap the caption display to `whitespace-pre-wrap`.)
- DB schema / RLS / types.
- TikTok send flow.

## Out of scope

- No new field for hashtags/topics — they're embedded inside the caption string per your format example.
- No changes to Instagram-specific flow (not yet implemented); the same caption works when added later.
