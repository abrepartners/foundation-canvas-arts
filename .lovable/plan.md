## The real problem

Today nothing verifies the carousel actually lands in your TikTok drafts. Here's why:

1. `post-tiktok-carousel` does all the work (image normalization + the call to TikTok's `content/init/`) inside `EdgeRuntime.waitUntil(bg())` and immediately returns `{ ok: true, queued: true }` — with **no `publish_id`**.
2. The client (`ContentDisplay.tsx`) then checks for `publish_id`, doesn't find one, hits the "No publish_id returned — treat as success but cannot poll" branch, and shows a green "Sent to TikTok" toast even if TikTok later rejected the payload in the background.
3. `tiktok-publish-status` exists and works, but it's never called because the client never gets a `publish_id`.

So the "success" you see is only "we handed it to the background task". If TikTok rejects it (bad URL prefix, image size, expired token, unverified domain, etc.), the only trace is a `console.error` in the edge function logs.

## Fix: make sending an observable job

Add a small persistence layer so the background task can report the real TikTok response back to the client.

### 1. New table `tiktok_send_jobs`

Columns:
- `id uuid pk`
- `created_at`, `updated_at`
- `content_id uuid` (nullable — for cross-reference)
- `phase text` — `queued | normalizing | initializing | publish_id_received | in_drafts | failed`
- `publish_id text` (nullable)
- `tiktok_status text` (nullable — last value from `publish/status/fetch`)
- `fail_reason text` (nullable)
- `raw jsonb` (last raw TikTok payload for debugging)

RLS: authenticated read/insert; service_role full. Standard GRANTs.

### 2. `post-tiktok-carousel` — return a `job_id` instantly, write progress from bg

- Synchronously insert a row with `phase = 'queued'`, return `{ job_id }` (still 202).
- In `bg()`, update the row as it moves: `normalizing` → `initializing` → on TikTok response, either `publish_id_received` (store `publish_id` + raw) or `failed` (store `fail_reason` + raw).
- On any thrown error in `bg()`, write `phase = 'failed'` with the message. This is what closes the current blind spot.

### 3. New endpoint `tiktok-send-status` (or extend `tiktok-publish-status`)

Input: `{ job_id }`. Behavior:
- Read the job row.
- If `phase in (queued, normalizing, initializing)` → return that phase.
- If `phase = failed` → return `{ status: 'FAILED', fail_reason, raw }`.
- If `publish_id` present and `tiktok_status` not terminal → call TikTok `publish/status/fetch/`, persist the result, and return it.
- If terminal (`SEND_TO_USER_INBOX` / `PUBLISH_COMPLETE` / `FAILED`) → return cached row without hitting TikTok.

Terminal `SEND_TO_USER_INBOX` = definitive proof it's in your drafts.

### 4. Client (`ContentDisplay.tsx`)

- Replace the current `pollStatus(publishId)` with `pollJob(jobId)` that hits the new endpoint every 2s.
- Remove the "No publish_id returned — treat as success" branch — it's the source of false positives.
- Show real phases in the UI: "Normalizing images…", "Sending to TikTok…", "Waiting for TikTok processing…", "In your TikTok drafts" (green, only on `SEND_TO_USER_INBOX`), or "Failed: <reason>" with the raw TikTok error visible.

### 5. Optional: `/queue` visibility

Add a small "TikTok send history" section on `/queue` (or a new `/tiktok` panel) that lists recent `tiktok_send_jobs` rows with phase, publish_id, fail_reason, and time — a persistent audit trail so you can confirm past sends without keeping the tab open.

## Out of scope

- No changes to image normalization logic.
- No change to `tiktok-oauth` or token refresh flow.
- No change to how `photo_images` are selected — this is purely about observability of the send.

## Result

After this, "did it actually reach the drafts?" has one truthful answer: the job row's phase becomes `in_drafts` only when TikTok returns `SEND_TO_USER_INBOX`. Any silent bg failure surfaces in the UI (and in the table) instead of being swallowed.