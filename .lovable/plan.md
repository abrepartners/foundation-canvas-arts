# Animated Tab — One-Click Video Pipeline (v2)

A new **Animated** tab. User clicks **Generate Animated Video**, walks away, comes back to a finished 60s+ vertical MP4. Live progress panel shows every stage. No prompts to write, no clips to pick, no stitching to do.

## Image model correction

Hero stills will be generated via **Replicate using the OpenAI `gpt-image-1` model** (the ChatGPT-image route already wired into your `regenerate-visual` flow when `image_provider = "openai"`). Gemini 2.5 Flash Image is NOT used in this pipeline. The existing botanical-study-plate prompt template carries over unchanged — only the provider is locked to OpenAI-via-Replicate.

## What the user sees

```text
┌─ Animated Video ──────────────────────────────┐
│  [ Generate Animated Video ]                  │
│                                               │
│  ● Picking plant + verifying fact      ✓ 4s   │
│  ● Writing 60s script (6 beats)        ✓ 11s  │
│  ● Designing 6 hero stills (OpenAI)    ✓ 52s  │
│  ● Animating clip 3 of 6  ▓▓▓▓▓░░░░   1m 12s  │
│  ○ Stitching final MP4                        │
│  ○ Saving to library                          │
│                                               │
│  [preview player appears here when done]      │
│  [ Download MP4 ]  [ Post to TikTok ]         │
└───────────────────────────────────────────────┘
```

Progress streams live via Supabase Realtime on a new `progress` jsonb column. Stills appear as they're created; clips appear as they finish.

## Pipeline (all automatic, all server-side)

1. **Fact + script** — reuse existing fact-selection + script generation. 6 beats (Hook / Dangle / Re-Hook / Dangle / Payoff / Close).
2. **Hero stills (6)** — **Replicate `openai/gpt-image-1`**, 1024×1792 (closest 9:16 it supports), upscaled/padded to 1080×1920. Existing botanical-study-plate prompts.
3. **Animations (6 × ~10s)** — Replicate image-to-video, content-aware motion. Model choice below.
4. **Stitch** — ffmpeg concat into one 60s MP4. Hard cuts in v1.
5. **Persist** — upload final MP4 + 6 source clips to new `botanical-animated-videos` bucket. Row in new `botanical_animated` table.
6. **Done** — player + Download + Post to TikTok.

## Cost + time comparison for both video models

Per finished 60s video (6 clips × 10s, 1080p 9:16). Stills are the same in both rows: 6 × OpenAI `gpt-image-1` ≈ **$0.24–$0.48** (~$0.04–0.08 per image).

| Option | Video model | Per-clip cost | 6 clips video | + 6 stills | **Total per video** | Wall time | Motion quality |
|---|---|---|---|---|---|---|---|
| **A — Premium** | `kwaivgi/kling-v3-omni-video` (10s, 1080p, 9:16) | ~$0.56 | ~$3.36 | ~$0.36 | **~$3.70 / video** | 6–10 min | Best prompt adherence; strongest for "plant growing", "berries ripening", "flower blooming" morphological change |
| **B — Budget** | `minimax/hailuo-02` (6s × 10 clips to hit 60s, 1080p, 9:16) | ~$0.27 | ~$2.70 (10 clips) | ~$0.36 | **~$3.06 / video** | 5–8 min | Good organic physics; less dramatic morphological change; 6s cap means more clips and more cuts |
| **B-lite** | `minimax/hailuo-02` at 768p instead of 1080p | ~$0.10 | ~$1.00 (10 clips) | ~$0.36 | **~$1.36 / video** | 4–7 min | Same motion as B; softer image; TikTok still accepts |

Prices are Replicate's public per-second rates as of the research run; treat ±20%. Lovable AI gateway adds no markup on Replicate connector calls beyond standard credit conversion.

**Volume math:** at 1 video/day for 30 days → Option A ≈ **$111/mo**, Option B ≈ **$92/mo**, Option B-lite ≈ **$41/mo**.

**My recommendation:** Option A. The whole reason you asked for elaborate animation (plant actually growing, not a push-in) is exactly what Kling v3 Omni is best at. The $0.65/video premium over Hailuo buys the motion quality you specifically said you wanted. If cost becomes an issue later, we add a toggle.

## Out of scope (deferred)

- Voiceover + audio mixing
- Crossfade transitions
- Per-beat clip editing

## Technical notes

- New route `/animated` with `AnimatedVideoPanel.tsx`. `/queue` untouched.
- New edge function `generate-animated-video` orchestrates everything. Writes `progress` jsonb on every stage transition. `verify_jwt = false`.
- Stills: call Replicate `openai/gpt-image-1` via existing connector gateway pattern; reuse the prompt builders in `src/lib/architecturalPlate.ts` / `plateTemplate.ts`.
- Clips: same gateway, `kwaivgi/kling-v3-omni-video` (Option A) — clip prompt auto-derived from beat's script line + visual prompt + a beat-type motion template (Hook=reveal/emerge, Payoff=bloom/ripen, Close=settle/wide).
- Concurrency: 2 clips in parallel to respect Replicate limits.
- ffmpeg concat in edge runtime via `npm:fluent-ffmpeg` static binary; fallback to a `stitch-video` second function if runtime hosting fails.
- New table `botanical_animated` (`id`, `plant_name`, `script`, `beats jsonb`, `still_urls text[]`, `clip_urls text[]`, `final_video_url`, `progress jsonb`, `queue_status`, `created_at`) with RLS + GRANTs matching `botanical_content`.
- New storage bucket `botanical-animated-videos` (public).
- Sidebar history gets second section "Animated Videos".

## Confirm before I build

1. Pick **Option A (premium Kling, ~$3.70/video)**, **B (Hailuo 1080p, ~$3.06/video)**, or **B-lite (Hailuo 768p, ~$1.36/video)**.
2. Confirm OpenAI `gpt-image-1` via Replicate for the 6 hero stills (replacing Gemini in this pipeline).
