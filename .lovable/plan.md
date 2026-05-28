## Goal
Run an end-to-end test of the botanical content generator and confirm every faceless visual image is created, uploaded to storage, and rendered in the UI.

## Steps

1. **Invoke the edge function** via `supabase--curl_edge_functions` (POST `/generate-botanical-content`) to produce a fresh content package. Capture `content_id` and the returned `faceless_visuals` array.

2. **Inspect edge function logs** (`supabase--edge_function_logs` for `generate-botanical-content`) to confirm:
   - DB insert succeeded
   - Image generation loop ran for up to 4 visuals
   - Each upload to `botanical-faceless-visuals` returned a public URL
   - No timeout / 4xx / moderation errors

3. **Verify DB state** with `supabase--read_query` on `botanical_content` for the new `content_id`, parsing `script_visuals` to check each entry has a non-null `image_url`.

4. **Verify storage objects** by listing files under `{content_id}/` in the `botanical-faceless-visuals` bucket and HEAD-checking one public URL returns 200.

5. **Verify UI rendering** by reloading the preview, selecting the new item from the history sidebar, and screenshotting the Faceless Visuals grid to confirm all images display in the 9:16 cards (and that regenerate buttons appear on hover).

## Outcome / report
A short summary listing: visuals expected vs. visuals with images, any moments that failed (with the log reason), and a screenshot of the rendered grid. If gaps exist, recommend whether to use the per-visual Regenerate button or adjust the timeout/concurrency in the edge function.

No code changes are planned — this is a verification run only. If issues surface, I'll come back with a follow-up fix plan.