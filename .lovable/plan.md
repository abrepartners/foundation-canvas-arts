## Goal
Make the Animated Video pipeline fully fire-and-forget. Close the tab at any time — the video finishes on the server and is ready when you return.

## Changes

### 1. New edge function: `animated-stitch`
- Called automatically by `animated-animate-all` after the 6th Kling clip uploads successfully.
- Invokes a Replicate ffmpeg concat model to stitch the 6 clips into a single 60s MP4.
- Polls the prediction, downloads the result, uploads it to `botanical-faceless-visuals/animated/{row_id}/final.mp4`.
- Updates the `botanical_animated` row: `final_video_url`, `queue_status = 'done'`, progress steps mark stitch + save as done.
- Wrapped in `EdgeRuntime.waitUntil` for ~150s of CPU.

### 2. Update `animated-animate-all`
- After all 6 clips are uploaded, instead of setting `queue_status = 'clips_done'`, it:
  1. Sets `queue_status = 'stitching'`.
  2. Invokes `animated-stitch` via `supabase.functions.invoke` (fire-and-forget).

### 3. Update `Animated.tsx`
- Remove `import { stitchClips } from "@/lib/stitchClips"` and all browser-side stitch code.
- Add auto-resume on mount: query `botanical_animated` for the most recent row where `queue_status` is NOT `done` or `error`. Load it into state and subscribe to realtime updates.
- If a row is stuck at `stitching` for >5 minutes, show a "Retry stitch" button.
- Change footer copy to: "Runs entirely on our servers. Close the tab anytime — your video will be waiting when you come back."
- Remove the `stitchProgress` state and the `stitch` step percentage detail.

### 4. Cleanup
- Delete `src/lib/stitchClips.ts`.
- Remove `@ffmpeg/ffmpeg` and `@ffmpeg/util` from `package.json` dependencies.
- Delete any leftover ffmpeg.wasm public assets if present.

## Cost
- Extra ~$0.01–0.02 per video for Replicate ffmpeg concat on top of existing ~$3.70.

## Out of scope
- Email/push notifications when done.
- Multiple concurrent generations.
- Retrying individual failed clips (unchanged).