# Botanical episode pipeline

## PR1: deterministic planning preview

The `/episodes` route compiles a reviewable production plan without calling an AI provider, writing production data, or starting a paid job. It implements the `botanical-video-v2` contract proven by the Peanut pilot:

- exactly 13 contiguous shots targeting 52 seconds, with a hard 50–54 second gate;
- an active second-person opening that connects a familiar object to an unexpected origin;
- narration and visuals organized as an immediate cause-and-effect chain;
- one kinetic caption track containing only one-to-three-word refreshes;
- no title headers, watermarks, game elements, or cartoon overlays;
- paired start/end frames for physical biological changes;
- restrained editorial movement for holds, pans, traces, and comparisons;
- restrained sound-design cues that begin and end with the visible action;
- an original British natural-history narrator direction with measured pacing and deliberate room for visual comprehension;
- a final endpoint that uses the same asset slot as the opening frame.

PR1 is a planner and compiler. It does not render media or submit provider jobs.

## Input contract

`EpisodeCompilerInput` requires a topic and can include an existing generated-content source:

```ts
{
  topic: "Peanut",
  source?: {
    contentId: string,
    plantName: string,
    assets: Array<{
      moment: "hook" | "dangle_1" | "rehook" | "dangle_2" | "verified_truth" | "close",
      url: string
    }>
  }
}
```

The compiler accepts only validated URLs already present in the selected content record. It does not manufacture storage URLs. Source images become reuse candidates only when the source plant and saved moment metadata match the curated topic. Metadata compatibility never marks anatomy or motion as visually approved. Incompatible sources are reported and ignored.

The output is validated by `EpisodePlanSchema`. It includes:

- the full shot timeline, narration, kinetic captions, stage, action, and camera direction;
- each shot's still or paired-frame-video route;
- each shot's biological, editorial, or intentional-hold motion intent and its action-timed sound cue;
- a pending/keep/change/remove review decision and beat-level note for every shot;
- reused asset slots and missing continuity keyframes;
- deterministic plan gates plus pending topic-specific visual QA requirements;
- a de-duplicated list of potential image and video jobs;
- generation counts and a provisional planning budget before any submission.
- export-only profiles for TikTok, Instagram Reels, and YouTube Shorts with posting disabled.
- narration word count, estimated speech time, reserved pause time, and a clear timed-voice-check requirement.

The default prices are provisional planning constants, not live quotes. Continuity images use a symbolic per-image allowance. Paired-frame video reserves the full planned shot duration at `$0.04 × output seconds`, so a five-second shot contributes `$0.20` to the provisional budget. A durable execution phase must obtain a current server-side quote and require confirmation before submission.

## Curated topics and gates

PR1 includes Peanut (`Arachis hypogaea`) and Strawberry (`Fragaria × ananassa`). Each registry entry supplies its reviewed fact ledger, ordered biological stages, 13-shot recipe, continuity asset slots, and four topic gate groups:

- **Anatomy:** required morphology and structures.
- **Counts:** exact counts where accuracy depends on them.
- **Connections:** which organs remain attached and which systems must remain separate.
- **Order:** required cause-and-effect stage sequence.

Each curated definition also contains a strict evidence ledger with authoritative source titles, HTTPS links, and the claims each source supports. Peanut uses the [USDA Agricultural Research Service Peanuts 101 guide](https://www.ars.usda.gov/southeast-area/dawson-ga/national-peanut-research-laboratory/docs/peanuts-101-the-basics/page-5/), the peer-reviewed [Annals of Botany paper on darkness and geotropic pod orientation](https://cris.huji.ac.il/en/publications/pod-formation-and-its-geotropic-orientation-in-the-peanut-arachis/), and the [USDA Pollination Handbook](https://www.ars.usda.gov/SP2UserFiles/Place/53420300/OnlinePollinationHandbook.pdf) for leaf and flower anatomy. Strawberry uses [NC State Extension's botany handbook](https://content.ces.ncsu.edu/extension-gardener-handbook/3-botany) and the [University of Connecticut strawberry factsheet](https://homegarden.cahnr.uconn.edu/factsheets/strawberries/). These sources appear in the compiled-plan interface for editorial review.

An unknown topic returns `needs_research`, activates the symbolic strong-model route, and produces zero paid jobs. Unsupported facts, factual conflicts, or repeated gate failures are the only reasons to use that tier. Routine compilation uses deterministic rules and a small-model slot for future constrained language filling.

PR1 may pass checks that are fully determined by the plan: curated fact-ledger availability, shot count, runtime, second-person hook, caption length, clean typography rules, declared stage order, and matched loop slots. Anatomy, counts, organ connections, biological motion, and the actual rendered loop remain `planned` until later visual QA examines the selected pixels and clips. A saved plant name and moment label alone cannot pass those output-quality gates.

## Narration, motion, and sound direction

The narrator contract calls for an original British natural-history documentary performance: calm curiosity, intelligent warmth, precise diction, and a measured target of 135 words per minute. Short pauses follow reveals and precede cause-and-effect turns so viewers have time to understand the image. The compiler reserves five of the 52 seconds for those pauses, calculates the maximum narration words available at the target pace, and exposes a `fits_estimate` or `needs_trimming` status. Even a fitting script remains `readyToRecord: false` until a timed voice test confirms the real performance. The contract explicitly prohibits imitating or cloning any named person.

Motion density is calculated for each compiled episode. Actions that change botanical state—open, grow, descend, enter, turn, swell, unfurl, ripen, and fill—route to paired-frame video. Pans, traces, and comparisons retain deliberate editorial movement. A static hold is labelled `intentional_hold` and is used only when movement would reduce anatomical clarity.

Every shot carries one subtle sound cue. Transformation cues start with the visible action and stop when it stops. Holds receive only low natural room tone. The design avoids constant impacts, exaggerated whooshes, and sounds that imply an event the viewer cannot see.

## Review and export planning

Each shot includes a review object with a `pending`, `keep`, `change`, or `remove` decision and a freeform beat-level note. The `/episodes` interface exposes both fields, so feedback such as a timing change on shot 06 can remain attached to the exact beat. In PR1 these edits live only in the current browser state, and the interface warns that recompiling or navigating away resets them. **Download plan + review JSON** validates the full plan against `EpisodePlanSchema` and exports all decisions and notes before the reviewer leaves. Durable server-side review persistence belongs to the later review phase.

The plan carries export-only profiles for TikTok, Instagram Reels, and YouTube Shorts. All three use a 9:16, 1080×1920, 30 fps H.264/AAC master with burned-in kinetic captions. `postingEnabled` is fixed to `false`; this work plans downloadable exports and does not invoke any social publishing path.

## Routing rules

Provider names are symbolic configuration, so the browser contains no credentials or live provider calls:

| Need | Symbolic route | Behavior |
| --- | --- | --- |
| Existing still + hold/pan/trace/compare | `editorial.still-motion` | Local movement; no paid generation |
| Missing continuity frame | `image.continuity` | One image job per unique missing asset slot |
| Open/grow/descend/enter/turn/swell/unfurl/ripen/fill | `video.paired-frame` | One video job with locked start/end frames; provisional cost uses $0.04 per full planned output second |
| Unsupported topic or disputed facts | `planner.strong` | Research/review only; paid media routes stay blocked |

The planner reports shared missing frames once even when multiple shots use them. A shot can therefore show a continuity-image route with `$0.00` at the shot level while the unique image job appears once in the episode total.

## Durable execution phases

The remaining work should be added behind the plan contract rather than mixed into the client compiler:

1. **Provider execution:** persist an approved plan, fetch server-side quotes, reserve a hard budget, submit idempotent jobs, record exact model versions/prompts/settings/prediction IDs/timing/cost, and never auto-retry a paid failure.
2. **Quality gates:** validate each returned keyframe and clip against anatomy, counts, connections, and stage order before selecting it for the edit.
3. **Narration and captions:** create narration through a configured voice route, retain word-level timing, and derive the one-to-three-word caption refreshes from that timing.
4. **Rendering:** assemble selected media, narration, music, captions, and the matched loop in an isolated render worker.
5. **Review:** publish the 13-shot editing timeline, collect keep/change/remove notes, and regenerate only rejected shots.

## Why FFmpeg should not run in Supabase Edge

Supabase Edge Functions are request-oriented Deno workers with execution, memory, filesystem, and deployment-size limits. A 1080×1920, 52-second composition needs a native FFmpeg binary, temporary media files, predictable CPU time, and durable retry/status handling. Put rendering in a dedicated background worker or job platform with object-storage inputs and outputs. Supabase should authenticate requests, reserve budgets, persist job state, and issue storage references; it should not perform the media encode itself.

This separation keeps the existing carousel generator, publishing flow, and legacy animation path unchanged while the episode pipeline is introduced incrementally.
