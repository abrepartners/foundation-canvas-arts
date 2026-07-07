## Two things to do

### 1. Let you pick which content to animate

Right now `/animated` always calls `animated-start`, which spins up a brand new plant + script + 6 stills. You've been staring at the same old row because we auto-load the most recent one on mount, and there's no way to say "animate that other okra I already generated."

**Plan:**

- **New picker on `/animated`** — a compact "Choose source" panel above the Generate button listing recent `botanical_content` rows that already have 6 completed stills (query `botanical_content` ordered by `created_at desc`, filter to rows where `script_visuals` has all 6 with `status: "done"` + `image_url`). Each row shows plant name + created date + tiny thumbnail row.
- **Two actions on the panel:**
  - **"Animate this one"** — starts an animated run reusing the selected content (skips script + stills).
  - **"Generate fresh"** — current behaviour, brand new plant.
- **`animated-start` edge function accepts an optional `source_content_id`.** When provided:
  - Skip the `generate-botanical-content` call
  - Load `plant_name`, `verified_fact`, `script`, `caption`, `script_visuals` from that row
  - Copy the 6 image URLs into the new `botanical_animated` row's `still_urls` in canonical order (`hook, dangle_1, rehook, dangle_2, verified_truth, close`)
  - Mark `script` + `stills` steps as `done` immediately
  - Set `queue_status: "stills_ready"` so the existing auto-trigger on the client fires `animated-animate-all` normally
- After a run starts, load the new row (as today) and show progress; picker collapses.

Nothing else in the pipeline (`animated-animate-all`, `animated-stitch`, motion prompts, storage layout, DB columns) needs to change.

### 2. Kling / animation docs

I don't have live Context7 or Kling docs pulled in — I've been working from what's baked into `animated-animate-all` (locked composition, per-moment motion, no narration text). Best path: **paste the Kling v2.1 image-to-video docs (input params, prompt guidance, limits, negative prompt guidance) into a new file** `mem://reference/kling-v21`, and I'll fold it into the motion library and negative prompts in a follow-up turn. If you drop it in chat I can also just save it directly — either works.

For this turn I'm **only** shipping the picker + `source_content_id` support, not touching the motion prompts, so we don't mix a UX change with a prompt rewrite.

## Out of scope

- Motion prompt / Kling params rewrites (waiting on the docs from you)
- Any change to still generation, stitching, TikTok send, caption flow
- DB schema changes
