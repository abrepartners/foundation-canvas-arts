
# 30-Day Automation → Monetization Plan

Backwards-planned from your 4 revenue streams: **Creator Rewards + Brand Deals + Affiliate + Own Digital Product**. All require the same upstream asset: **a growing, high-watch-time TikTok feed**. So we build the growth/quality engine first, then bolt monetization rails on top.

## The Backwards Chain

```text
$$$  ← Creator Rewards payout, brand DMs, affiliate clicks, product sales
 ↑
10k followers + 1M qualifying views  ← requires consistent virality
 ↑
2–3 posts/day, each optimized pre-publish & learned-from post-publish
 ↑
One-click approve queue + scheduled auto-post
 ↑
Generation engine (already built) + virality scoring + analytics feedback
```

We work bottom-up over 4 weeks.

---

## Week 1 — Quality Gate & Approval Queue
Goal: stop posting anything that isn't pre-scored for virality.

1. **Pre-publish virality score** (no analytics needed, works day 1)
   - Score hook on: first-3-words punch, curiosity gap, length, hashtag mix, caption title strength
   - Gemini rates 0–100 with 1-line reasoning + suggests 2 punchier hook rewrites
2. **Hook A/B variants** — generate 3 hook options per plant, auto-pick highest-scoring, surface other 2 as one-tap swaps
3. **Approval queue UI** — new `/queue` page: card per pending video with Approve / Regenerate hook / Reject. Approving moves it to scheduled.

## Week 2 — Scheduled Auto-Post (2–3/day)
Goal: zero manual posting once approved.

1. **`content_schedule` table** — `id, content_id, scheduled_for, status, posted_video_id`
2. **`scheduler` edge function on pg_cron** — every 15 min, posts any approved item whose slot has arrived via existing TikTok publish flow
3. **Time-slot picker** — defaults to 12pm / 6pm / 9pm ET (peak plant-tok windows), editable per item
4. **Daily generation cron** — auto-generates 4 candidates/day at 6am so the queue is always full

## Week 3 — Analytics Feedback Loop
Goal: every post teaches the generator.

1. **`tiktok_analytics` table** — `video_id, views, likes, shares, comments, watch_time_avg, completion_rate, follows, fetched_at`
2. **Analytics poll cron** — pulls TikTok `video/query/` every 6h for last 30 days of app-posted videos
3. **Analytics dashboard** — leaderboard, top hooks, completion-rate winners, best posting times
4. **AI post-mortem** — weekly Gemini run compares top-5 vs bottom-5, outputs pattern rules, **auto-injects them into the generation system prompt** (this is the compounding edge)

## Week 4 — Monetization Rails

1. **Bio link router** (`/go` page on the published domain) — single TikTok bio link → mobile-optimized hub: Amazon affiliate plant gear, email opt-in, future product
2. **Affiliate caption injector** — generator auto-appends "🌱 Plant tools I use → link in bio" to captions, rotated per video
3. **Email capture** — ConvertKit/Resend opt-in on `/go` for the "Weird Plant Facts" newsletter — seeds the audience you own for the future ebook/course
4. **Creator Rewards check** — by end of week 4, dashboard surfaces eligibility (followers, qualified-view threshold) and flags when to enable it
5. **Brand-deal media kit page** — `/press` auto-built from analytics: top videos, total views, demographics, contact form

---

## What You Get on Day 30

- Engine generates 4 candidates/day → you approve in <5 min → scheduler posts 2–3/day automatically
- Every post is pre-scored and learns from the last week's winners
- Bio link monetizes traffic from view #1 (affiliate)
- Email list compounds the audience for your own product launch in month 2
- Media kit ready the moment a brand DM lands

## Technical Notes
- All new backend = Supabase edge functions + pg_cron (existing stack)
- AI calls = Lovable AI Gateway, Gemini 2.0 Flash for scoring/post-mortem
- TikTok analytics = existing connector, `video/query/` endpoint
- New tables: `content_schedule`, `tiktok_analytics`, `email_subscribers`, `hook_variants`
- No new paid services required for week 1–3; week 4 only adds an email provider (Resend is already wired)

## Build Order Confirmation
I'll execute Week 1 first end-to-end, then check in before Week 2 — that way you see the approval queue + scoring working on real generations before we automate posting. Approve this plan and I'll start with the virality scorer + queue UI.
