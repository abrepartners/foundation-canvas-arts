## Goal
Confirm the regenerate button flow works by exercising the `regenerate-visual` edge function against the latest content row and verifying the result reaches storage, DB, and UI.

## Steps
1. **Pick a target** — query `botanical_content` for the most recent row and pull a `faceless_visuals` entry (prefer the `close` moment that was skipped in the last generation run, otherwise any existing one to confirm upsert).
2. **Invoke the function** — call `regenerate-visual` via `supabase--curl_edge_functions` with `{ content_id, moment, prompt }` and capture `image_url` from the response.
3. **Check edge logs** — `supabase--edge_function_logs` for `regenerate-visual` to confirm: image API success, upload success, DB update success, no errors.
4. **Verify storage** — HEAD the returned `image_url` (HTTP 200, `image/png`).
5. **Verify DB** — re-query `botanical_content.script_visuals` for that row and confirm the targeted moment now has the new `image_url`.
6. **Verify UI** — reload the preview, open the item from history, screenshot the Faceless Visuals grid to confirm the regenerated card renders.

## Notes
- No code changes — verification only.
- If a step fails, I'll surface the exact log line and propose a fix in a follow-up plan.