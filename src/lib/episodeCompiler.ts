import {
  EPISODE_MAX_SECONDS,
  EPISODE_MIN_SECONDS,
  EPISODE_RECIPE_ID,
  EPISODE_SHOT_COUNT,
  EPISODE_TARGET_SECONDS,
  EpisodeCompilerInputSchema,
  EpisodePlanSchema,
  EpisodeRouteConfigSchema,
  type BiologicalAction,
  type EpisodeCompilerInput,
  type EpisodePlan,
  type EpisodeRouteConfig,
  type TopicDefinition,
} from "@/lib/episodeSchema";
import { findTopicDefinition, normalizeTopic } from "@/lib/episodeTopicRegistry";

export const DEFAULT_EPISODE_ROUTE_CONFIG: EpisodeRouteConfig = EpisodeRouteConfigSchema.parse({
  routinePlanner: { routeName: "planner.rules", model: "deterministic-botanical-video-v2" },
  strongPlanner: { routeName: "planner.strong", model: "strong-model-slot" },
  continuityImage: { routeName: "image.continuity", model: "gpt-image-slot", estimatedUnitCostUsd: 0.12 },
  pairedFrameVideo: { routeName: "video.paired-frame", model: "paired-frame-video-slot", estimatedCostPerSecondUsd: 0.04 },
});

export const PHYSICAL_ACTIONS: ReadonlySet<BiologicalAction> = new Set([
  "open", "grow", "descend", "enter", "turn", "swell", "unfurl", "ripen", "fill",
]);

export const ORIGINAL_NARRATOR_PROFILE = {
  profileId: "original-british-natural-history" as const,
  label: "Original British natural-history narrator",
  direction: "An original British natural-history documentary performance with intelligent warmth, calm curiosity, precise diction, and measured pacing that lets the botanical action lead.",
  accent: "British English" as const,
  targetWordsPerMinute: 135,
  pauseGuidance: "Leave short, deliberate pockets after each reveal and before each cause-and-effect turn so the viewer can read the image.",
  originalityConstraint: "Use an original performance. Do not imitate or clone any named person.",
  routeName: "narration.original-natural-history",
};

export const SHORT_FORM_EXPORT_PROFILES = [
  { platform: "tiktok" as const, label: "TikTok", aspectRatio: "9:16" as const, resolution: "1080x1920" as const, frameRate: 30 as const, videoCodec: "H.264" as const, audioCodec: "AAC" as const, captionMode: "burned-in kinetic captions" as const, deliveryMode: "export-only" as const, postingEnabled: false as const },
  { platform: "instagram_reels" as const, label: "Instagram Reels", aspectRatio: "9:16" as const, resolution: "1080x1920" as const, frameRate: 30 as const, videoCodec: "H.264" as const, audioCodec: "AAC" as const, captionMode: "burned-in kinetic captions" as const, deliveryMode: "export-only" as const, postingEnabled: false as const },
  { platform: "youtube_shorts" as const, label: "YouTube Shorts", aspectRatio: "9:16" as const, resolution: "1080x1920" as const, frameRate: 30 as const, videoCodec: "H.264" as const, audioCodec: "AAC" as const, captionMode: "burned-in kinetic captions" as const, deliveryMode: "export-only" as const, postingEnabled: false as const },
];

function soundDesignForAction(action: BiologicalAction) {
  const cues: Record<BiologicalAction, string> = {
    hold: "Natural room tone with a nearly imperceptible organic bed",
    pan: "Soft leaf-and-air texture following the camera drift",
    compare: "Quiet tonal shift as the compared structures align",
    trace: "Fine dry-brush movement following the traced connection",
    open: "Delicate shell or plant-fibre separation",
    grow: "Low organic stretch rising with visible growth",
    descend: "Soft downward soil texture following the moving tip",
    enter: "Muted soil press at the instant of surface contact",
    turn: "Restrained organic bend following the visible directional change",
    swell: "Low rounded bloom building only during visible expansion",
    unfurl: "Light leaf-fibre release following the opening edge",
    ripen: "Warm tonal bloom following the visible colour change",
    fill: "Soft internal pulses aligned to visible filling",
  };
  return {
    cue: cues[action],
    timing: action === "hold" ? "Continuous beneath the intentional hold" : `Begin with the visible ${action}; end when that action stops`,
    intensity: "subtle" as const,
    relationToVisual: action === "hold" ? "Supports the stillness without inventing an event" : `Audible only while the on-screen ${action} occurs`,
  };
}

function motionIntentForAction(action: BiologicalAction) {
  if (PHYSICAL_ACTIONS.has(action)) return "biological_motion" as const;
  if (action === "hold") return "intentional_hold" as const;
  return "editorial_motion" as const;
}

function emptyMotionCoverage() {
  return {
    biologicalMotionShots: 0,
    editorialMotionShots: 0,
    intentionalHoldShots: 0,
    movingShotPercent: 0,
    rationale: "Motion coverage is unavailable until a supported topic has a compiled timeline.",
  };
}

const RESERVED_NARRATION_PAUSE_SECONDS = 5;

function countNarrationWords(value: string): number {
  return value.match(/[A-Za-z0-9]+(?:['’][A-Za-z0-9]+)*/g)?.length ?? 0;
}

function buildNarrationTiming(narration: string, duration: number) {
  const targetWordsPerMinute = ORIGINAL_NARRATOR_PROFILE.targetWordsPerMinute;
  const wordCount = countNarrationWords(narration);
  const availableSpeechSeconds = duration - RESERVED_NARRATION_PAUSE_SECONDS;
  const maxWordsAtTargetPace = Math.floor((availableSpeechSeconds * targetWordsPerMinute) / 60);
  const estimatedSpeechSeconds = Math.round(((wordCount / targetWordsPerMinute) * 60) * 10) / 10;
  const estimatedTotalSeconds = Math.round((estimatedSpeechSeconds + RESERVED_NARRATION_PAUSE_SECONDS) * 10) / 10;
  const fits = wordCount <= maxWordsAtTargetPace;
  return {
    wordCount,
    targetWordsPerMinute,
    estimatedSpeechSeconds,
    reservedPauseSeconds: RESERVED_NARRATION_PAUSE_SECONDS,
    estimatedTotalSeconds,
    remainingVisualSeconds: Math.round((duration - estimatedTotalSeconds) * 10) / 10,
    availableSpeechSeconds,
    maxWordsAtTargetPace,
    status: fits ? "fits_estimate" as const : "needs_trimming" as const,
    readyToRecord: false as const,
    note: fits
      ? "The script fits the estimated speech-and-pause budget. A timed voice test is still required before recording is approved."
      : `Trim at least ${wordCount - maxWordsAtTargetPace} words before a timed voice test.`,
  };
}

function buildShotNarrationTiming(narration: string, duration: number) {
  const wordCount = countNarrationWords(narration);
  const estimatedSpeechSeconds = Math.round(((wordCount / ORIGINAL_NARRATOR_PROFILE.targetWordsPerMinute) * 60) * 10) / 10;
  const remainingVisualSeconds = Math.round((duration - estimatedSpeechSeconds) * 10) / 10;
  return {
    wordCount,
    estimatedSpeechSeconds,
    availableShotSeconds: duration,
    remainingVisualSeconds,
    status: remainingVisualSeconds >= 0 ? "fits_estimate" as const : "needs_trimming" as const,
  };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function topicMatchesSource(topic: TopicDefinition, plantName: string): boolean {
  const sourceName = normalizeTopic(plantName);
  return [topic.id, topic.commonName, topic.scientificName, ...topic.aliases]
    .map(normalizeTopic)
    .some((candidate) => sourceName === candidate || sourceName.includes(candidate));
}

function compileUnknown(input: EpisodeCompilerInput, config: EpisodeRouteConfig): EpisodePlan {
  const narrationTiming = buildNarrationTiming("", EPISODE_TARGET_SECONDS);
  return EpisodePlanSchema.parse({
    recipeId: EPISODE_RECIPE_ID,
    status: "needs_research",
    topicQuery: input.topic,
    sources: [],
    targetDuration: EPISODE_TARGET_SECONDS,
    allowedDuration: { min: EPISODE_MIN_SECONDS, max: EPISODE_MAX_SECONDS },
    totalDuration: 0,
    plannerRoute: {
      ...config.strongPlanner,
      escalationRequired: true,
      reason: "This topic has no curated fact ledger. Research and conflict resolution are required before any paid route can be planned.",
    },
    narratorProfile: ORIGINAL_NARRATOR_PROFILE,
    narrationTiming,
    exportProfiles: SHORT_FORM_EXPORT_PROFILES,
    motionCoverage: emptyMotionCoverage(),
    ...(input.source ? {
      source: {
        contentId: input.source.contentId,
        plantName: input.source.plantName,
        compatible: false,
        reusedAssetCount: 0,
      },
    } : {}),
    assets: [],
    shots: [],
    gates: [{
      id: "topic.supported",
      label: "Curated botanical fact ledger",
      status: "blocked",
      detail: "Unknown topics cannot be marked ready and produce no paid generation routes.",
    }],
    generationJobs: [],
    estimates: { paidGenerationCount: 0, continuityImageCount: 0, pairedFrameVideoCount: 0, totalCostUsd: 0 },
    rules: {
      captions: "single-track, one-to-three-word phrases",
      typography: "no headers or watermarks",
      motion: "paired start/end frames for biological actions",
      loop: "final endpoint matches opening frame",
    },
  });
}

export function compileBotanicalEpisode(
  rawInput: EpisodeCompilerInput,
  rawConfig: EpisodeRouteConfig = DEFAULT_EPISODE_ROUTE_CONFIG,
): EpisodePlan {
  const input = EpisodeCompilerInputSchema.parse(rawInput);
  const config = EpisodeRouteConfigSchema.parse(rawConfig);
  const topic = findTopicDefinition(input.topic);
  if (!topic) return compileUnknown(input, config);

  const sourceCompatible = input.source ? topicMatchesSource(topic, input.source.plantName) : false;
  const sourceAssets = sourceCompatible ? input.source?.assets ?? [] : [];
  const assignedSourceMoments = new Set<string>();
  const assets = topic.assetSlots.map((slot) => {
    const sourceAsset = sourceAssets.find((candidate) =>
      slot.reuseMoments.includes(candidate.moment) && !assignedSourceMoments.has(candidate.moment),
    );
    if (sourceAsset) assignedSourceMoments.add(sourceAsset.moment);
    return {
      slotId: slot.id,
      label: slot.label,
      status: sourceAsset ? "reused" as const : "missing" as const,
      ...(sourceAsset ? { sourceUrl: sourceAsset.url, sourceMoment: sourceAsset.moment } : {}),
    };
  });
  const assetById = new Map(assets.map((asset) => [asset.slotId, asset]));
  const requiredSlots = new Set(topic.shots.flatMap((candidate) => [candidate.startAssetSlot, candidate.endAssetSlot].filter(Boolean) as string[]));
  const missingSlots = assets.filter((asset) => requiredSlots.has(asset.slotId) && asset.status === "missing");

  const imageJobs = missingSlots.map((asset) => ({
    id: `image:${asset.slotId}`,
    kind: "continuity_image" as const,
    routeName: config.continuityImage.routeName,
    model: config.continuityImage.model,
    assetSlotId: asset.slotId,
    estimatedCostUsd: config.continuityImage.estimatedUnitCostUsd,
  }));

  const videoJobs = topic.shots
    .filter((candidate) => PHYSICAL_ACTIONS.has(candidate.action))
    .map((candidate) => {
      const plannedDurationSeconds = candidate.end - candidate.start;
      return {
        id: `video:${candidate.id}`,
        kind: "paired_frame_video" as const,
        routeName: config.pairedFrameVideo.routeName,
        model: config.pairedFrameVideo.model,
        shotId: candidate.id,
        plannedDurationSeconds,
        estimatedCostPerSecondUsd: config.pairedFrameVideo.estimatedCostPerSecondUsd,
        estimatedCostUsd: roundMoney(plannedDurationSeconds * config.pairedFrameVideo.estimatedCostPerSecondUsd),
      };
    });

  const shots = topic.shots.map((candidate) => {
    const neededSlotIds = [candidate.startAssetSlot, candidate.endAssetSlot].filter(Boolean) as string[];
    const reusedAssetSlots = neededSlotIds.filter((slotId) => assetById.get(slotId)?.status === "reused");
    const missingKeyframes = neededSlotIds.filter((slotId) => assetById.get(slotId)?.status === "missing");
    const isPhysical = PHYSICAL_ACTIONS.has(candidate.action);
    const plannedVideoCost = roundMoney(
      (candidate.end - candidate.start) * config.pairedFrameVideo.estimatedCostPerSecondUsd,
    );
    const route = isPhysical
      ? {
          mode: "paired_frame_video" as const,
          routeName: config.pairedFrameVideo.routeName,
          model: config.pairedFrameVideo.model,
          estimatedCostUsd: plannedVideoCost,
          reason: `“${candidate.action}” changes physical botanical state and requires matched start/end frames. The provisional budget uses $${config.pairedFrameVideo.estimatedCostPerSecondUsd.toFixed(2)} per second for the full ${(candidate.end - candidate.start).toFixed(1)}-second shot.`,
        }
      : missingKeyframes.length > 0
        ? {
            mode: "continuity_image" as const,
            routeName: config.continuityImage.routeName,
            model: config.continuityImage.model,
            estimatedCostUsd: 0,
            reason: "Editorial movement is free after the missing continuity still is created; the shared image job is counted once in the plan total.",
          }
        : {
            mode: "editorial_still" as const,
            routeName: "editorial.still-motion",
            model: "local-renderer",
            estimatedCostUsd: 0,
            reason: `“${candidate.action}” can use a hold, pan, trace, or comparison over an existing still.`,
          };
    return {
      ...candidate,
      duration: candidate.end - candidate.start,
      route,
      reusedAssetSlots,
      missingKeyframes,
      // PR1 can validate the recipe and metadata, but it cannot visually inspect
      // a selected still or generated clip. Every shot therefore remains planned
      // until the durable QA phase evaluates its actual pixels and motion.
      gateStatus: "planned" as const,
      motionIntent: motionIntentForAction(candidate.action),
      soundDesign: soundDesignForAction(candidate.action),
      narrationTiming: buildShotNarrationTiming(candidate.narration, candidate.end - candidate.start),
      review: { decision: "pending" as const, note: "" },
    };
  });

  const biologicalMotionShots = shots.filter((candidate) => candidate.motionIntent === "biological_motion").length;
  const editorialMotionShots = shots.filter((candidate) => candidate.motionIntent === "editorial_motion").length;
  const intentionalHoldShots = shots.filter((candidate) => candidate.motionIntent === "intentional_hold").length;
  const movingShotPercent = Math.round(((biologicalMotionShots + editorialMotionShots) / shots.length) * 100);

  const totalDuration = topic.shots.reduce((sum, candidate) => sum + candidate.end - candidate.start, 0);
  const narrationTimingEstimate = buildNarrationTiming(topic.shots.map((candidate) => candidate.narration).join(" "), totalDuration);
  const overlongShotCount = shots.filter((candidate) => candidate.narrationTiming.status === "needs_trimming").length;
  const narrationTiming = overlongShotCount === 0
    ? narrationTimingEstimate
    : {
        ...narrationTimingEstimate,
        status: "needs_trimming" as const,
        note: `${overlongShotCount} shot${overlongShotCount === 1 ? "" : "s"} exceed their individual timing windows and need trimming before a timed voice test.`,
      };
  const captionsValid = topic.shots.every((candidate) =>
    candidate.captions.every((phrase) => phrase.trim().split(/\s+/).length >= 1 && phrase.trim().split(/\s+/).length <= 3),
  );
  const hookIsProximate = /\byou\b/i.test(topic.shots[0].narration);
  const loopMatches = topic.shots[topic.shots.length - 1]?.endAssetSlot === topic.shots[0].startAssetSlot;
  const timingValid = totalDuration >= EPISODE_MIN_SECONDS && totalDuration <= EPISODE_MAX_SECONDS;

  const gates = [
    { id: "topic.supported", label: "Curated botanical fact ledger", status: "pass" as const, detail: `${topic.commonName} has reviewed facts, anatomy, counts, connections, and stage order.` },
    { id: "recipe.shot_count", label: "Thirteen-shot structure", status: topic.shots.length === EPISODE_SHOT_COUNT ? "pass" as const : "blocked" as const, detail: `${topic.shots.length} of ${EPISODE_SHOT_COUNT} required shots.` },
    { id: "recipe.duration", label: "50–54 second runtime", status: timingValid ? "pass" as const : "blocked" as const, detail: `${totalDuration.toFixed(1)} seconds total; target is ${EPISODE_TARGET_SECONDS}.` },
    { id: "script.proximate_hook", label: "Second-person proximate hook", status: hookIsProximate ? "pass" as const : "blocked" as const, detail: "The opening makes the viewer connect a familiar object with its unexpected botanical origin." },
    { id: "captions.phrase_length", label: "Kinetic caption phrase length", status: captionsValid ? "pass" as const : "blocked" as const, detail: "Every caption refresh contains one to three words on a single track." },
    {
      id: "narration.pacing_budget",
      label: "Narration and pause budget",
      status: narrationTiming.status === "fits_estimate" ? "planned" as const : "blocked" as const,
      detail: `${narrationTiming.wordCount} words take about ${narrationTiming.estimatedSpeechSeconds.toFixed(1)} seconds at ${narrationTiming.targetWordsPerMinute} words per minute, with ${narrationTiming.reservedPauseSeconds} seconds reserved for visual pauses. ${narrationTiming.note}`,
    },
    { id: "style.clean", label: "Clean text treatment", status: "pass" as const, detail: "The recipe forbids title headers, watermarks, gamification, and cartoon overlays." },
    { id: "sequence.botanical", label: "Botanical stage order", status: "pass" as const, detail: topic.orderedStages.join(" → ") },
    { id: "loop.exact_endpoint", label: "Matched loop endpoint", status: loopMatches ? "pass" as const : "blocked" as const, detail: "The last shot returns to the exact asset slot used at frame one." },
    ...(input.source ? [{
      id: "source.compatibility",
      label: "Generated-content compatibility",
      status: "planned" as const,
      detail: sourceCompatible
        ? `${assignedSourceMoments.size} stills match by topic and saved moment metadata; each remains a candidate until visual QA.`
        : `${input.source.plantName} does not match ${topic.commonName}; its URLs are ignored and fresh keyframes are planned.`,
    }] : []),
    ...Object.entries(topic.gates).map(([kind, rules]) => ({
      id: `topic.${kind}`,
      label: `${kind[0].toUpperCase()}${kind.slice(1)} gates`,
      status: "planned" as const,
      detail: `${rules.join(" ")} These requirements must be checked against selected stills and clips during visual QA.`,
    })),
  ];

  const generationJobs = [...imageJobs, ...videoJobs];
  const totalCostUsd = roundMoney(generationJobs.reduce((sum, job) => sum + job.estimatedCostUsd, 0));
  return EpisodePlanSchema.parse({
    recipeId: EPISODE_RECIPE_ID,
    status: gates.some((gate) => gate.status === "blocked") ? "needs_research" : "ready",
    topicQuery: input.topic,
    topicId: topic.id,
    topicName: topic.commonName,
    scientificName: topic.scientificName,
    sources: topic.sources,
    targetDuration: EPISODE_TARGET_SECONDS,
    allowedDuration: { min: EPISODE_MIN_SECONDS, max: EPISODE_MAX_SECONDS },
    totalDuration,
    plannerRoute: {
      ...config.routinePlanner,
      escalationRequired: false,
      reason: "A curated fact ledger and deterministic rules are sufficient. The strong-model slot stays off unless facts conflict or gates repeatedly fail.",
    },
    narratorProfile: ORIGINAL_NARRATOR_PROFILE,
    narrationTiming,
    exportProfiles: SHORT_FORM_EXPORT_PROFILES,
    motionCoverage: {
      biologicalMotionShots,
      editorialMotionShots,
      intentionalHoldShots,
      movingShotPercent,
      rationale: "Physical biological changes receive real paired-frame movement; pans, traces, and comparisons retain purposeful editorial motion; holds are used only when stillness protects anatomical readability.",
    },
    ...(input.source ? {
      source: {
        contentId: input.source.contentId,
        plantName: input.source.plantName,
        compatible: sourceCompatible,
        reusedAssetCount: assignedSourceMoments.size,
      },
    } : {}),
    assets,
    shots,
    gates,
    generationJobs,
    estimates: {
      paidGenerationCount: generationJobs.length,
      continuityImageCount: imageJobs.length,
      pairedFrameVideoCount: videoJobs.length,
      totalCostUsd,
    },
    rules: {
      captions: "single-track, one-to-three-word phrases",
      typography: "no headers or watermarks",
      motion: "paired start/end frames for biological actions",
      loop: "final endpoint matches opening frame",
    },
  });
}

export function serializeEpisodePlan(plan: EpisodePlan): string {
  return JSON.stringify(EpisodePlanSchema.parse(plan), null, 2);
}
