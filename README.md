# Botanical Studio

Private botanical image and caption generator with optional TikTok draft delivery.

## Production

- Site: https://foundation-canvas-arts.vercel.app
- Hosting: Vercel
- Backend: owner-controlled Supabase project `thxkzaazwkdtacfvdiyn`
- AI generation: Replicate

The application intentionally exposes only the Botanical Content Generator, its latest 10 records, private Settings, and the TikTok draft action attached to a completed content package.

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
