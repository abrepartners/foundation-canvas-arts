# Botanical Studio

Private botanical image and caption generator with optional TikTok draft delivery.

## Production

- Site: https://foundation-canvas-arts.vercel.app
- Hosting: Vercel
- Backend: owner-controlled Supabase project `thxkzaazwkdtacfvdiyn`
- AI generation: Replicate

The application intentionally exposes only the Botanical Content Generator, its latest 10 records, private Settings, and the TikTok draft action attached to a completed content package.

## Botanical episode planning

Authenticated users can open `/episodes` to compile a no-spend, 13-shot production plan for a curated botanical topic. The planner can reuse compatible images from an existing generated package, identifies missing continuity keyframes, routes physical changes to paired-frame video, and shows gate status plus a provisional generation count and budget before any provider work. It also carries restrained action-timed sound cues, an original narrator profile, shot-level review notes, and export-only TikTok/Reels/Shorts profiles with posting disabled. A current server-side quote is still required before generation.

PR1 performs deterministic planning in the browser and does not generate or render media. See [docs/EPISODE_PIPELINE.md](docs/EPISODE_PIPELINE.md) for the recipe contract, routing rules, and later execution phases.

## Local development

Requirements: Node.js 20 or newer and npm.

```sh
npm install
npm run dev
```

The frontend requires these environment variables:

```sh
VITE_SUPABASE_PROJECT_ID=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_URL=
```

## Security

- The browser never receives the database service-role key or Replicate token.
- PIN verification occurs in a Supabase Edge Function with rate limiting.
- The stored PIN is a bcrypt hash.
- Successful PIN verification creates a real Supabase Auth session.
- Row-level security limits browser reads to the single application owner.
- Database mutations and provider calls run through authenticated Edge Functions.
- Replicate and publishing credentials must be configured as backend secrets and must never be committed.

## Deployment

Push changes through GitHub and deploy the connected Vercel project. Database changes live in the consolidated owner-only migration under `supabase/migrations`.
