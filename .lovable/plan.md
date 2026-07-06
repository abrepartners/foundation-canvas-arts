## What's happening now

`animated-animate-all` sends one prompt per clip to Kling v2.1 that's built like this:

```ts
const prompt = `${motion} ${scriptLine}`.slice(0, 1500);
```

Two problems:

1. **`scriptLine` is the narration**, not a motion description. Appending "Pomegranates aren't really a fruit in the way you think..." to a video-motion prompt confuses Kling — the model tries to visualize the words, which is where clips 3, 4, 5 turn into "random crap."
2. **The `MOTION_BY_MOMENT` presets are too generic** and not tied to what the still actually shows. `rehook` says "diagonal specimen pushes across the frame" but the still is already a static diagonal composition — there's no motion identity, so Kling improvises.

Clip 6 (`close`) not generating is a separate failure (Kling timeout or upload error). It's already surfaced via `queue_status: error`, but the current UI probably didn't retry. Out of scope for this plan unless you want a retry button — say the word.

## Fix — a real motion library, locked to each still

Rewrite the motion system in `animated-animate-all` so every clip has:

- A **choreography** that only makes sense for the still it's animating (a growing hero can only start from the hero shot; a specimen-part reveal can only happen on the evidence board).
- **Zero narration bleed** — the script text is removed from the video prompt. Kling only sees motion instructions + a negative prompt.
- **Anchored start-frame behavior** — every prompt explicitly says "starting from the exact provided image, do X, hold Y" so the still is preserved as frame 0 and the motion is additive, not reinterpretive.

### The six locked choreographies (per moment)

Each is a compact, camera-first instruction. No storytelling verbs, no script echo.

- **hook — "Grows from the ground"**
  Start on the hero still with the specimen partially buried in soft soil / darkness at the bottom of frame. Over 10s the plant rises vertically ~15% of frame height, leaves gently unfurl, one warm rim-light sweeps left→right across the surface. Camera is locked, no zoom. Ends holding on the still's original composition.

- **dangle_1 — "Macro breathing" (already good, tightened)**
  Start on the extreme macro still. Slow 8% push-in along the surface texture over 10s, shallow depth of field breathes in and out once, a few dust or pollen particles drift diagonally through the light. No pan, no rotation.

- **rehook — "Diagonal parallax"**
  Start on the diagonal composition. Camera translates left-to-right by ~6% while the specimen holds its 45° angle, creating a strong parallax reveal against the background haze. Shadows lengthen slightly as the light source appears to shift. No rotation of the subject itself.

- **dangle_2 — "Cross-section opens"**
  Start on the top-down dissection still. The two halves gently separate ~4% along the horizontal axis, revealing more of the internal anatomy in the gap. Magnifier circles softly pulse once. Camera stays locked overhead. No zoom, no pan.

- **verified_truth — "Evidence lays itself out"**
  Start on the labeled A/B/C/D evidence board. The specimen parts settle into place with the tiniest correction motion (~2%), measurement brackets extend outward from each label as thin lines drawing themselves over 10s. Camera locked overhead. Feels like an archival document animating itself.

- **close — "Final quiet turn"**
  Start on the minimal centered specimen. The specimen rotates in place a single slow quarter-turn (never a full spin), the golden-ratio diagram softly traces around it as a thin line drawing, a barely-there vignette closes ~2% at the corners. Ends on stillness.

### Prompt-building change

In `animateOne`:

```ts
const motion = MOTION_BY_MOMENT[moment];      // new, richer preset (above)
const prompt = motion;                         // no more scriptLine append
```

And extend the negative prompt to actively fight the "random crap" failure mode:

```ts
negative_prompt:
  "blurry, low quality, distorted, text artifacts, watermark, logo, frame border, " +
  "morphing subject, changing species, extra plants appearing, hands, people, " +
  "text overlays, captions, subtitles, jump cuts, whip pans, camera shake, " +
  "rapid zoom, style change, cartoon, oversaturated colors"
```

### Nothing else changes

- Same Kling v2.1 model, same 10s duration, same start_image anchoring, same concurrency 2, same storage path scheme, same progress reporting.
- No DB schema changes.
- No UI changes on `/animated`.
- Existing rows are unaffected until you re-animate them (the fix only applies to new runs).

## Out of scope

- Retrying the failed `close` clip on the Pomegranate row (say the word if you want a "Retry failed clip" button on `/animated`).
- Changing stitching, audio, or the still-generation prompts.
- Changing the motion library per-plant — motions stay locked to moment identity, not plant identity.

## Result

Every clip is a purposeful, composition-aware motion that reinforces its still instead of drifting. Hook actually grows from the ground. Macro keeps breathing. Rehook has real parallax. Dissection opens. Evidence lays itself out. Close resolves. No more "random crap" from narration bleeding into the video prompt.
