## Goal

Add a "Regenerate caption" action so old saved posts (with the old two-line caption) can be upgraded to the new long-form SEO botanical-verification caption — without re-running script or image generation.

## How it works

A small "Regenerate" button appears in the Caption card (on both Botanical and Trends pages). Clicking it calls a new edge function that:

1. Loads the row's existing topic + facts (`plant_name` / `subject`, `verified_fact`, full `script`).
2. Calls Lovable AI (Gemini 3 Flash) with the same SEO caption spec used by the generators — passed as a focused prompt that only outputs the caption text.
3. Saves the new caption to the row via service-role (bypassing RLS, since UPDATE is denied to clients by design).
4. Returns the new caption; the UI swaps it in immediately.

Works on freshly generated content and on history items loaded from the sidebar.

## Changes

### 1. New edge function: `supabase/functions/regenerate-caption/index.ts`

- POST body: `{ table: "botanical_content" | "trend_content", id: string }`.
- Validate inputs (zod-style guard), reject unknown table values.
- Fetch the row by id with the service-role client; pull `plant_name`/`subject`, `verified_fact`, `script` (parse JSON), `raw_content` as fallback context.
- Build a self-contained caption-only prompt that embeds the full SEO caption spec (175–300 words, 12-step structure, brand line "My brother studies plants. / I verify the facts.", `Topics covered:` block, 5 hashtags, hard rules) and the topic context.
- Call Lovable AI gateway (`google/gemini-3-flash-preview`) via `https://ai.gateway.lovable.dev/v1/chat/completions` returning a plain text caption (no JSON wrapper — the response IS the caption). Handle 429/402 with clear error.
- `UPDATE botanical_content|trend_content SET caption = $new WHERE id = $id` via service role.
- Return `{ ok: true, caption }` with CORS headers.

No DB migration needed — UPDATE via service-role already works, and the existing client-side RLS deny stays in place (clients never UPDATE directly).

### 2. `src/hooks/useBotanicalContent.ts` and `src/hooks/useTrendContent.ts`

- Add `regenerateCaption()` that:
  - Checks `content.id` exists (toast if not).
  - Sets a local `isRegeneratingCaption` flag.
  - Invokes `regenerate-caption` with `{ table, id }`.
  - On success: updates `content.caption` in local state, toasts success.
  - On failure: toasts the error message verbatim.
- Export `regenerateCaption` + `isRegeneratingCaption` from each hook.

### 3. `src/components/ContentDisplay.tsx`

- Accept new optional props: `onRegenerateCaption?: () => Promise<void>` and `isRegeneratingCaption?: boolean`.
- In the Caption `ContentCard`, render a small ghost button next to Copy: "Regenerate" with a `RotateCcw` icon + spinner state. Disabled while regenerating or when no `content.id` exists.
- Keep `whitespace-pre-wrap` so the new structured caption renders correctly.

### 4. `src/pages/Index.tsx` and `src/pages/Trends.tsx`

- Destructure `regenerateCaption`, `isRegeneratingCaption` from the respective hook.
- Pass them through to `<ContentDisplay ... />`.

## Notes

- Costs are minimal (single short AI call per click).
- Old rows whose `script` is missing still work because the prompt also accepts `verified_fact` + `raw_content` as fallback context.
- No schema, RLS, or types change — `caption` is already `text` on both tables.
- Out of scope: bulk "regenerate every old caption" job. Per-item regeneration only, triggered from the UI.
