# Vercel Readiness Audit — Botanical TikTok (diagnose only, no changes made)

## 1. Backend reachability

Two different backends are in play, and the app points at the wrong one.

| Ref | Status | Evidence |
|---|---|---|
| `pscwdryzcwgtwvliszpc` (in `.env`, `client.ts` fallback, `supabase/config.toml`) | **Does not resolve** | `getent hosts` returns nothing; every curl to `*.supabase.co` for this ref returns connection failure (code 000) |
| `pswlaczoevrclemhjjpw` (Lovable Cloud) | **Live and healthy** | REST `GET /botanical_content` → 200 with real rows; Edge Functions respond; DNS resolves |

The running preview serves `VITE_BOTANICAL_SUPABASE_URL = https://pscwdryzcwgtwvliszpc.supabase.co`, so the browser client is currently talking to a dead host. A Vercel build using the repo `.env` values would ship the same dead URL.

**Blocker A (critical):** frontend env/config points at a nonexistent project ref. Data API and Edge Functions for the live backend are externally reachable from anywhere (plain HTTPS + publishable key, no IP allowlist), so Vercel hosting itself is not a problem — only the ref is.

Note: `supabase/config.toml` `project_id` also names the dead ref, which is why the management connection reports INACTIVE while Lovable tool queries (which target the live ref) still work.

## 2. Replicate key

- `REPLICATE_API_KEY` **is present** in Edge Function secrets, listed as connector-managed (editable only via Connectors).
- It could **not** be validated: secrets are not readable from here, and no deployed function exposes a non-generating Replicate account check. Adding one would be a code change, which this audit excludes.
- Because the key is connector-managed, it is worth confirming whether it is your own Replicate token or a Lovable-brokered credential — that determines who is billed after you leave Lovable hosting.

**Blocker B:** Replicate auth is unverified, and key ownership/billing path is unconfirmed.

## 3. Passcode gate

- `APP_PASSCODE` is configured as a secret.
- Live check against the deployed `score-content` on the live ref:
  - no header → `401 {"error":"Unauthorized"}`
  - `x-app-passcode: 0801` → `200 {"ok":true}`
- `animated-pricing` with the same header → `200` with the full pricing payload.

So deployed functions accept `0801`, and `0801` is hardcoded in the browser bundle (`src/lib/passcode.ts`). This is effectively a public credential: anyone who loads the site can read it and call every paid function (image, Kling video, TikTok publish).

**Blocker C (critical for cost):** the only thing standing between the public internet and Replicate spend is a 4-digit string shipped in client JS.

## 4. Botanical Content Generator mapping (as coded)

**Text package** — `generate-botanical-content`, Replicate `google/gemini-2.5-flash`
Input: `system_prompt` (zero-memory botanical prompt + novelty block), `prompt: "Generate a complete botanical content package now."`, `temperature: 0.8`, `max_output_tokens: 8000`.

**Images** — provider chosen by request `image_provider`; default `replicate`.
- FLUX: `black-forest-labs/flux-1.1-pro` — `prompt`, `aspect_ratio: "9:16"`, `output_format: "jpeg"`, `safety_tolerance: 2`, `prompt_upsampling: false`.
- GPT Image 2: `openai/gpt-image-2` — `prompt`, `quality: "high"`, `aspect_ratio: "9:16"`, `output_format: "jpeg"`.

**JSON → `botanical_content` columns**

| JSON field | Column |
|---|---|
| `plant_name` | `plant_name` |
| `verified_fact` | `verified_fact` |
| `script` (object) | `script` (JSON string) |
| `thumbnail_prompt` | `thumbnail` (JSON string) |
| `caption` | `caption` |
| `part2_hook` | `part2_hook` |
| `faceless_visuals[]` | `script_visuals` (JSON string) |
| full model output | `raw_content` |

**Six moments → tiles:** exactly six required and de-duplicated — `hook`, `dangle_1`, `rehook`, `dangle_2`, `verified_truth`, `close` — sorted into that order and seeded as `{moment, prompt, image_url: null, status: "queued"}`. Each slot then moves `queued → generating` (stamping `started_at`) → `done` or `error`, and the UI grid renders one tile per slot from `script_visuals`.

**Retry / resume:** row is inserted immediately and images run in the background via `EdgeRuntime.waitUntil`; FLUX runs are staggered 12s apart, gpt-image-2 is capped at 2 concurrent. Each slot gets 1 automatic retry after a 4s delay, then is marked `error`. Replicate create retries up to 3× on HTTP 429; polling caps around 90 iterations (45 in resume). The client auto-invokes `generate-botanical-resume` for slots in `error` or `generating` > 2 minutes, limited to 2 auto-resumes, after which a manual "Retry stuck" button appears. Runs with an `animation_row_id` are tracked in `animation_provider_jobs` for idempotency and honor `stop_requested_at`.

## 5. Mismatches

1. **Frontend ref vs live backend** — `.env` / `client.ts` / `config.toml` name the dead ref; all live data and functions are on the other ref. This is the single biggest deployment blocker.
2. **`app_members` migration never applied** — REST returns `PGRST205 Could not find the table 'public.app_members'`. The migration's RLS model (read only for rows whose owner is an `app_members` user) is therefore not in force.
3. **Live RLS vs migration intent** — live tables still carry the permissive read policies: anon `SELECT` on `botanical_content` and `botanical_animated` returns real rows without any auth. Anon writes are correctly blocked (`42501 permission denied`). So the database is read-open to the world, which the intended `app_members` model was meant to close.
4. **Passcode frontend vs JWT-era migration** — the app has no Supabase Auth session at all (sessionStorage flag only), so `auth.uid()` is always null. Applying the `app_members` migration as written would break every client read, since no request carries a JWT.
5. **`config.toml` verify_jwt = true on several functions** while the client sends only the anon key and a passcode header — currently tolerated because the anon key satisfies the JWT check, but it is not real authorization.

## 6. Safest minimal path to a private Vercel deployment

1. **Point the app at the live ref.** Set `VITE_BOTANICAL_SUPABASE_URL` / `..._PUBLISHABLE_KEY` / `..._PROJECT_ID` in Vercel env to the live project, and remove the dead-ref fallbacks from `client.ts` so a missing env fails loudly instead of silently targeting a dead host. Align `supabase/config.toml`.
2. **Stop shipping the passcode.** Replace the client-side `0801` constant with a real single-user Supabase Auth login (one owner account, email+password, no self-signup). Functions then validate the JWT server-side; nothing spendable is reachable with a value pasted from the bundle.
3. **Close public reads.** Once a real session exists, replace the `USING (true)` policies on `botanical_content`, `botanical_animated`, `animation_provider_jobs`, and `trend_content` with owner-scoped policies, and only then apply the `app_members` migration (or a simpler `auth.uid() = <owner uuid>` check).
4. **Protect Replicate spend server-side**, not just at the gate: keep `verify_jwt = true`, keep the single-active-run index and per-row retry budgets, and add a daily spend ceiling checked in `animated-pricing`/`animated-start` so even an authenticated mistake cannot run away.
5. **Own the Replicate key.** Move from the connector-managed key to your own Replicate token stored as an Edge Function secret, so billing is on your account and unaffected by Lovable connector state. Validate it once with a `GET https://api.replicate.com/v1/account` call (no prediction, no cost).
6. **Lock CORS to the Vercel domain.** `_shared/cors.ts` currently allows any `*.lovable.app`, `*.lovableproject.com`, `*.lovable.dev`, and localhost origin. Set `APP_ORIGIN` to the Vercel URL and drop the wildcard branches for production.

## Blocker summary

- **Critical:** frontend targets a nonexistent Supabase ref — app cannot work on Vercel as configured.
- **Critical:** paid Edge Functions are callable by anyone who reads `0801` from the bundle.
- **High:** database rows are world-readable via the anon key.
- **Medium:** Replicate key validity and billing ownership unverified.
- **Medium:** `app_members` migration is unapplied and incompatible with the current passcode-only frontend.
