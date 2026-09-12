# Reconnect TikTok so sends update and the feed loads

## What's actually wrong

Your TikTok account is connected, but with an old, stale authorization:

- The stored access token expired on July 20, 2026. The long-lived refresh token is still valid (through June 2027), so send-status can refresh it — but only for what the old approval covers.
- The old approval only granted "basic profile" and "upload to drafts". It does **not** include permission to read your video list, which is exactly what the live feed on the Insights page needs. That's why the feed stays empty.
- The re-authorize link in the app currently breaks: the table that holds the one-time security token for the sign-in handshake was never created in the live database, so starting a fresh TikTok authorization fails before it reaches TikTok.

## What I'll do

1. Add the missing one-time-handshake table (plus the two small companion tables the connection screen expects) to the live database. Nothing existing is touched: your 66 saved content items, images, PIN, owner login, and send history all stay as they are.
2. Redeploy the TikTok functions so the authorization link, send, send-status, and Insights all run the current code.
3. Give you a fresh "Connect TikTok" link from the Insights page that asks for the right permissions: profile, upload to drafts, and read your video list. You approve it once with your TikTok account.
4. Confirm afterwards, with no posting and no spend: the new approval is stored with the video-list permission, your profile and recent videos load in the live feed, and a pending send row resolves to a real TikTok status instead of spinning.

Posting stays **drafts only** — content lands in your TikTok inbox for you to review and publish. No direct-to-feed publishing is enabled.

## What I need from you

Only one step: click the connect link and approve on TikTok, granting all requested permissions (if you uncheck the video-list one, the feed stays empty).

If your TikTok developer app hasn't got this project's callback address registered, TikTok will refuse the approval with a redirect error. If that happens I'll show you the exact address to paste into the developer portal and we retry.

## Technical notes

- Idempotent migration: create `platform_oauth_states`, `platform_connections`, `content_metrics` per the checked-in baseline, RLS enabled, service-role writes, member read where the app reads them. No drops, no column changes, no data edits.
- Redeploy: `platform-insights`, `tiktok-oauth`, `post-tiktok-carousel`, `tiktok-send-status`, `tiktok-publish-status`.
- Scopes requested on re-auth: `user.info.basic`, `video.upload`, `video.list`. Redirect URI stays `${SUPABASE_URL}/functions/v1/tiktok-oauth`; `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` unchanged.
- Verification, all no-spend: `tiktok_tokens` row shows new scope and future `expires_at`; `platform-insights` status returns connected profile plus video list; `tiktok-send-status` returns a real `tiktok_status` for an existing job; typecheck and build pass.
- Untouched: PIN auth, six-image generator, Episode Planner, animation pipeline, Replicate config, prompts, models.
