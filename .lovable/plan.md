## Goal
A second mode of the app, on its own page `/trends`, that mirrors today's Botanical flow but works for **any subject** (octopuses, Roman history, espresso, etc.) and is seeded by **TikTok Creator Search Insights** trending topics rather than a hardcoded plant focus. Visuals reuse the existing 9:16 museum study-plate style. Posting reuses the existing `post-tiktok-carousel` function.

## User flow
1. User navigates to `/trends` (linked from a small nav in the header on `/`).
2. Page shows a **Subject** input (free text, e.g. "deep-sea creatures") + a **Suggest trending topics** button.
3. Clicking Suggest calls a new edge function `tiktok-trend-suggestions` that hits TikTok Creator Search Insights via the connector gateway and returns 6–10 trending keyword chips related to the typed subject (or general trending if empty). Clicking a chip fills the input.
4. User clicks **Generate Carousel**. The same pipeline runs: AI picks one counterintuitive, verifiable fact about the subject, writes the 30-second script (HOOK/DANGLE/RE-HOOK/DANGLE/PAYOFF/CLOSE), generates 6 museum-plate 9:16 visuals, stores everything.
5. ContentDisplay renders identically; user can regenerate visuals and **Send to TikTok** via the existing flow.

## Backend
- New edge function `tiktok-trend-suggestions` (verify_jwt=false, CORS): POST `{ subject?: string }`. Calls TikTok Creator Search Insights through the connector gateway (`https://connector-gateway.lovable.dev/tiktok/research/...`) using `LOVABLE_API_KEY` + `TIKTOK_API_KEY`. Returns `{ topics: string[] }`. Validates input with Zod.
- New edge function `generate-trend-content` (verify_jwt=false, CORS): clone of `generate-botanical-content` parameterized by `subject`. Same JSON contract, same Gemini 2.0 Flash text + Gemini 2.5 Flash Image Preview visuals, same Zero-Memory rules, same museum study-plate prompt scaffolding (subject swapped for plant). Persists to a new `trend_content` table (same columns as `botanical_content` but `subject` instead of `plant_name`).
- New migration: `trend_content` table mirroring `botanical_content` columns; GRANTs + RLS policies matching the existing public-read/write model used today. Uses the same `botanical-faceless-visuals` storage bucket (folder prefix `trends/`).
- `post-tiktok-carousel` is reused as-is; the page passes the same content shape.

## Frontend
- New route `/trends` registered in `App.tsx` above the catch-all.
- New page `src/pages/Trends.tsx` modeled on `Index.tsx`: subject input, trending-chips row, Generate button, reuses `ContentDisplay`, has its own `HistorySidebar` reading from `trend_content`.
- New hook `src/hooks/useTrendContent.ts` paralleling `useBotanicalContent.ts` but calling the new functions/table and accepting a `subject` argument.
- Small header nav added to both pages: "Plants" / "Trends" links so the user can switch modes.
- Reuses all existing UI components (`GenerateButton`, `ContentDisplay`, `HistorySidebar`) — `HistorySidebar` gets an optional `labelField` prop so it can show `subject` instead of `plant_name`.

## Constraints honored
- Zero-Memory policy: every visual prompt fully restates style; AI text outputs self-contained JSON, no markdown.
- Museum botanical study-plate aesthetic applied verbatim to any subject (per your choice).
- Same models, same JSON contract, same novelty guard pattern (last 5 entries from `trend_content`).
- No changes to `botanical_content`, `post-tiktok-carousel`, `tiktok-oauth`, or `client.ts`.

## Open question (non-blocking, default chosen)
TikTok Creator Search Insights requires a research/insights scope that the current OAuth connection may not have. Default plan: try the gateway call first; if the connector returns a scope error, the suggestions endpoint falls back to asking Gemini for "currently trending TikTok topics related to {subject}" so the UI always works. If you want hard-fail-with-reconnect instead, say so before I build.
