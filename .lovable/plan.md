## What's actually happening

Your latest job row (`dfec587b…`) is stuck at `phase = normalizing` and never moves. Edge logs confirm why:

```
post-tiktok-carousel  ERROR  CPU Time exceeded
```

The background task in `post-tiktok-carousel` is decoding + resizing + JPEG-encoding every carousel image with `imagescript` (WASM). For a 6–10 image portrait carousel that easily blows the Edge Function per-invocation CPU budget. When the runtime kills the worker mid-loop:

- the loop never reaches the `initializing` update
- the `catch` never runs, so `phase = failed` is never written
- the client keeps polling `tiktok-send-status`, which keeps returning `phase: normalizing`
- nothing is ever sent to TikTok, and no reconnect will fix it — the OAuth token is fine, the function just dies before it ever calls TikTok

So: not a TikTok auth issue. It's a CPU-budget issue in our own normalization step.

## Fix — two parts

### 1. Remove the heavy work from the send path

Move image normalization out of `post-tiktok-carousel` entirely. The visuals are already generated and stored in the `botanical-faceless-visuals` bucket; normalize them once at generation time instead of every time we send.

- In `generate-botanical-content` (and any other function that writes visuals to the bucket), after uploading the PNG, also upload a TikTok-ready JPEG variant at a stable path (`tiktok-jpeg/<original>-1080x1920-q85.jpg`) using the same logic that's currently in `post-tiktok-carousel`. One image at a time, right after it's created — well within budget.
- Store that JPEG URL alongside the original in whatever field currently feeds `photo_images` (or expose a helper that maps original → jpeg URL).
- `post-tiktok-carousel` then does **zero** decoding: it just checks `url.includes('/tiktok-jpeg/')`, and if so passes it straight to TikTok's `content/init/`. No `imagescript`, no CPU pressure, no timeout risk.
- Keep the current `normalizeToTikTokJpeg` function as a lazy fallback for old content that predates this change, but log a warning when it fires so we can migrate the rest.

### 2. Watchdog so the UI never loops again

Even after the fix, we should never let the client poll forever on a dead background task.

- In `tiktok-send-status`, when the job is in a non-terminal pre-publish phase (`queued` / `normalizing` / `initializing`) and `updated_at` is older than **90 seconds**, mark it `phase = failed` with `fail_reason = "Background task died before contacting TikTok (likely CPU timeout). Try sending again."` and return that to the client.
- Client already handles `phase: failed` → shows the reason and stops polling. No new UI work needed.

### 3. Unblock the current stuck job

One-off DB update to flip `dfec587b-c566-44c4-8781-54c564aa919e` to `failed` so the currently-open tab stops spinning:

```sql
update tiktok_send_jobs
set phase = 'failed',
    fail_reason = 'Background task exceeded CPU limit during image normalization',
    updated_at = now()
where id = 'dfec587b-c566-44c4-8781-54c564aa919e';
```

## Out of scope

- No changes to TikTok OAuth, tokens, or `photo_images` selection.
- No change to image visual style or generation prompts.
- No retry-on-failure automation — if a send fails, the user re-clicks Send.

## Result

- Sending a carousel becomes a lightweight call (init only), so it can't hit the CPU cap.
- Any future background failure surfaces in the UI within 90s instead of looping forever.
- The current stuck job is cleared so you can send again immediately.
