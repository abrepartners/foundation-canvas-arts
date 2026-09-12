# TikTok is alive again — one permission still missing for the live feed

## What the checks show (all read-only, no posting, no spend)

- Your TikTok login refreshed successfully at 10:49 CT — TikTok accepted it. Sending drafts and send-status will work again.
- Read directly from TikTok: your "Verified Botanical" profile answers, and your recent video list loads (peanut and strawberry posts are there).
- But the in-app Insights feed still can't show it: the login saved inside the app only carries "profile + upload drafts". The "read my video list" permission is still missing from the stored approval.

## Why

The re-authorization handshake never completed. The one-time approval link started at 10:34 CT expired unused at 10:44, and the app's TikTok callback received no new approval — no fresh authorization was ever saved. What happened at 10:49 was a refresh of the old login, which restores sending but can't add new permissions.

## What I'll do

1. Generate one fresh connect link and have you complete the TikTok approval in a single pass, leaving every requested permission checked — including the video-list one.
2. Verify afterwards, with no posting and no spend: the stored approval shows the video-list permission, your profile and recent videos appear in the app's live feed, and a pending send resolves to a real TikTok status.
3. If TikTok instead shows a redirect error, that means the callback address isn't registered in your developer app — I'll give you the exact address to paste, then we retry.

Nothing changes in your saved content, images, PIN, owner login, or send history. Posting stays drafts only.

## Technical notes

- Evidence: `tiktok_tokens` updated 15:49 (fresh `expires_at` 2026-09-13) but `scope = user.info.basic,video.upload`; `platform_oauth_states` newest row `used_at = null`, expired 15:44; gateway reads of `user/info/` and `video/list/` both returned 200.
- Scopes requested on re-auth: `user.info.basic`, `video.upload`, `video.list`. Redirect URI stays `${SUPABASE_URL}/functions/v1/tiktok-oauth`; client key/secret unchanged. Links expire after 10 minutes, so each attempt needs a newly generated link.
