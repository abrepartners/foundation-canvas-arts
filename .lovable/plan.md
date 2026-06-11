## Goal
After **Send to TikTok**, show real-time progress (not just a spinner) until TikTok confirms the carousel is actually sitting in the user's drafts/inbox, then mark complete. If TikTok reports a failure, surface the reason.

## How TikTok signals "in drafts"
`post/publish/content/init/` returns a `publish_id`. The real status comes from polling `post/publish/status/fetch/`, which returns a `status` enum that walks through: `PROCESSING_DOWNLOAD` → `PROCESSING_UPLOAD` → `SEND_TO_USER_INBOX` (terminal success — the post is now a draft in TikTok), or `FAILED` (terminal failure with `fail_reason`).

## Backend changes
- **`post-tiktok-carousel`**: also return `publish_id` (extracted from the TikTok response) alongside the existing payload so the client can start polling.
- **New edge function `tiktok-publish-status`** (verify_jwt=false, CORS): POST `{ publish_id: string }`. Loads the most recent token from `tiktok_tokens` (same refresh logic as `post-tiktok-carousel`), calls TikTok `post/publish/status/fetch/`, returns `{ status, fail_reason?, raw }`. Zod-validates input.

## Frontend changes (`src/components/ContentDisplay.tsx`)
Replace the single boolean `sendingTikTok` with a small state machine:
- `idle` → `initializing` (calling our function) → `uploading` (TikTok PROCESSING_DOWNLOAD/UPLOAD) → `in_drafts` (terminal success) → back to `idle` after a few seconds, or → `failed` (with reason).

After `post-tiktok-carousel` returns a `publish_id`, poll `tiktok-publish-status` every 2s (cap ~60 polls / 2 min) and translate each status to a friendly label.

UI:
- Replace the static spinner inside the **Send to TikTok** button with an inline progress block that appears under the button while the send is active. The block shows:
  - A 4-step checkmark stepper: **Initializing → Uploading to TikTok → Processing → In your drafts**. Current step pulses, completed steps show a check, failed step shows an X.
  - An indeterminate `Progress` bar while not terminal.
  - On success: green check + "Open the TikTok app — the carousel is now a draft in your inbox." A small "Send another" button collapses the block.
  - On failure: red X + the `fail_reason` from TikTok (e.g. "url_ownership_unverified", "spam_risk_user_banned_from_posting"). Retry button reappears.
- Keep the existing toast for at-a-glance feedback, but the inline block is the primary signal.

## What stays the same
- No schema changes.
- `tiktok-oauth` untouched.
- `post-tiktok-carousel` keeps the same request shape; only the response gains `publish_id`.
- No new secrets.

## Edge cases
- Polling timeout (over 2 min in PROCESSING_*): show "Still processing — check the TikTok app in a minute." (non-error end state).
- Network/edge errors during polling: retry up to 3 times, then surface as failed with the underlying message.
- Re-clicking Send while a previous send is mid-flight is blocked by the button's disabled state, as today.
