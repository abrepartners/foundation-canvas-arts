# TikTok approval didn't land — finish the connection

## What the check shows

Your approval never came back to the app:

- The one-time handshake started at 10:34 CT and was never completed; it expired ten minutes later at 10:44.
- The TikTok callback in this app received no requests at all — TikTok never returned to us.
- The stored TikTok login is still the old one: expired on July 20, and still missing the "read my video list" permission the live feed needs.

So the connection is unchanged. Most likely causes, in order: the approval screen was closed or timed out, or this app's callback address isn't registered in your TikTok developer app, which makes TikTok stop with a redirect error before returning.

## What to do next

1. Start a fresh link from the Insights page (the old one has expired — a new one is required each time) and complete the TikTok approval in one go, leaving every requested permission checked.
2. If TikTok shows a redirect error instead of the approval screen, that confirms the callback address is missing. I'll give you the exact address to paste into your TikTok developer app's login-kit redirect list, then you retry.
3. Once the approval returns, I confirm without posting or spending: the new login is stored with the video-list permission and a future expiry, your profile and recent videos load in the live feed, and a pending send resolves to a real TikTok status.

Nothing changes in your saved content, images, PIN, owner login, or send history. Posting stays drafts only.

## Technical notes

- No code or schema changes needed; the repair from the previous plan is already applied and deployed.
- Evidence: `platform_oauth_states` newest row `used_at = null`, expired; `tiktok_tokens` unchanged (`scope = user.info.basic,video.upload`, `expires_at 2026-07-20`); `tiktok-oauth` has no invocation logs.
- Scopes requested: `user.info.basic`, `video.upload`, `video.list`. Redirect URI stays `${SUPABASE_URL}/functions/v1/tiktok-oauth`; client key/secret unchanged.
- State rows expire after 10 minutes, so each attempt needs a newly generated link.
