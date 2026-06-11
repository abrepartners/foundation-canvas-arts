## Why it's failing

TikTok's Content Posting API (`media_type: PHOTO`, `PULL_FROM_URL`) only accepts **JPEG** images. The app is currently sending six `.png` URLs from the `botanical-faceless-visuals` bucket, so TikTok creates a `publish_id`, runs its file format check, and returns `status: FAILED` with `fail_reason: file_format_check_failed`. That's the message you saw.

## Fix: convert to JPEG on send

Per your choice, keep existing PNGs in storage but transcode them to JPEG inside the `post-tiktok-carousel` edge function right before calling TikTok. No changes to image generation, no migration needed.

## Changes

**`supabase/functions/post-tiktok-carousel/index.ts`**
1. After validating the incoming `photo_images` array, for each URL:
   - Download the PNG bytes with `fetch`.
   - Decode with `ImageScript` (`https://deno.land/x/imagescript`) — pure-Deno, no native deps, works in the edge runtime.
   - Re-encode as JPEG (quality ~90).
   - Derive a stable destination path mirroring the source path but with a `.jpg` extension under a `tiktok-jpeg/` prefix in the same `botanical-faceless-visuals` bucket (e.g. `tiktok-jpeg/<carousel-id>/hook.jpg`). Use `upsert: true` so re-sends are idempotent.
   - Upload via the service-role Supabase client with `contentType: "image/jpeg"`.
   - Collect the public URL.
2. Run the six conversions in parallel with `Promise.all` to keep latency low (~1–3s total instead of sequential).
3. If any URL already ends in `.jpg`/`.jpeg`, skip transcoding and pass it through.
4. Send the new JPEG URLs to TikTok in the existing `photo_images` payload. Everything else (token refresh, polling, response shape) stays the same.
5. On transcode/upload failure, return a clear 502 with the failing URL so the UI can surface it instead of TikTok's opaque rejection.

## Notes

- The bucket is already public, so the resulting `.jpg` URLs are immediately reachable by TikTok's puller.
- The existing URL-prefix verification in your TikTok dev portal still applies (same bucket host), so no portal change is needed.
- Old content in history will now succeed on send because conversion happens at send-time, not generation-time.
- No DB schema, RLS, or front-end changes required. The 4-step progress UI keeps working as-is — it'll just reach "In your drafts" instead of failing.
