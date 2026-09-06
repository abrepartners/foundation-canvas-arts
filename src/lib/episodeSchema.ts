import { z } from "zod";

export const EPISODE_RECIPE_ID = "botanical-video-v2" as const;
export const EPISODE_SHOT_COUNT = 13;
export const EPISODE_TARGET_SECONDS = 52;
export const EPISODE_MIN_SECONDS = 50;
export const EPISODE_MAX_SECONDS = 54;

export const BiologicalActionSchema = z.enum([
  "hold",
  "pan",
  "compare",
  "trace",
  "open",
  "grow",
  "descend",
  "enter",
  "turn",
  "swell",
  "unfurl",
  "ripen",
  "fill",
]);

export const StageTypeSchema = z.enum([
  "hook",
  "setup",
  "mechanism",
  "development",
  "anatomy",
  "payoff",
  "loop",
]);

export const SourceMomentSchema = z.enum([
  "hook",
  "dangle_1",
  "rehook",
  "dangle_2",
  "verified_truth",
  "close",
]);

export const CaptionPhraseSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => value.split(/\s+/).length <= 3, "Captions must contain one to three words");

export const AssetSlotSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  reuseMoments: z.array(SourceMomentSchema),
}).strict();

export const TopicSourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  supports: z.array(z.string().min(1)).min(1),
}).strict();

export const RecipeShotSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  stageType: StageTypeSchema,
  botanicalStage: z.string().min(1),
  start: z.number().nonnegative(),
  end: z.number().positive(),
  action: BiologicalActionSchema,
  narration: z.string().min(1),
  captions: z.array(CaptionPhraseSchema).min(1),
  startAssetSlot: z.string().min(1),
  endAssetSlot: z.string().min(1).optional(),
  visualDirection: z.string().min(1),
  gateIds: z.array(z.string().min(1)),
}).strict().refine((shot) => shot.end > shot.start, {
  message: "Shot end must follow its start",
});

export const TopicDefinitionSchema = z.object({
  id: z.string().min(1),
  commonName: z.string().min(1),
  scientificName: z.string().min(1),
  aliases: z.array(z.string().min(1)),
  facts: z.array(z.string().min(1)).min(1),
  sources: z.array(TopicSourceSchema).min(1),
  orderedStages: z.array(z.string().min(1)).min(2),
  gates: z.object({
    anatomy: z.array(z.string().min(1)).min(1),
    counts: z.array(z.string().min(1)).min(1),
    connections: z.array(z.string().min(1)).min(1),
    order: z.array(z.string().min(1)).min(1),
  }).strict(),
  assetSlots: z.array(AssetSlotSchema).min(1),
  shots: z.array(RecipeShotSchema).length(EPISODE_SHOT_COUNT),
}).strict();

export const ExistingEpisodeAssetSchema = z.object({
  moment: SourceMomentSchema,
  url: z.string().url(),
}).strict();

export const ExistingEpisodeSourceSchema = z.object({
  contentId: z.string().min(1),
  plantName: z.string().min(1),
  assets: z.array(ExistingEpisodeAssetSchema),
}).strict();

export const EpisodeCompilerInputSchema = z.object({
  topic: z.string().trim().min(1),
  source: ExistingEpisodeSourceSchema.optional(),
}).strict();

export const EpisodeRouteConfigSchema = z.object({
  routinePlanner: z.object({
    routeName: z.string().min(1),
    model: z.string().min(1),
  }).strict(),
  strongPlanner: z.object({
    routeName: z.string().min(1),
    model: z.string().min(1),
  }).strict(),
  continuityImage: z.object({
    routeName: z.string().min(1),
    model: z.string().min(1),
    estimatedUnitCostUsd: z.number().nonnegative(),
  }).strict(),
  pairedFrameVideo: z.object({
    routeName: z.string().min(1),
    model: z.string().min(1),
    estimatedCostPerSecondUsd: z.number().nonnegative(),
  }).strict(),
}).strict();

export const GateResultSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(["pass", "planned", "blocked"]),
  detail: z.string().min(1),
}).strict();

export const SoundDesignCueSchema = z.object({
  cue: z.string().min(1),
  timing: z.string().min(1),
  intensity: z.literal("subtle"),
  relationToVisual: z.string().min(1),
}).strict();

export const ReviewFeedbackSchema = z.object({
  decision: z.enum(["pending", "keep", "change", "remove"]),
  note: z.string(),
}).strict();

export const NarratorProfileSchema = z.object({
  profileId: z.literal("original-british-natural-history"),
  label: z.string().min(1),
  direction: z.string().min(1),
  accent: z.literal("British English"),
  targetWordsPerMinute: z.number().int().positive(),
  pauseGuidance: z.string().min(1),
  originalityConstraint: z.string().min(1),
  routeName: z.string().min(1),
}).strict();

export const ExportProfileSchema = z.object({
  platform: z.enum(["tiktok", "instagram_reels", "youtube_shorts"]),
  label: z.string().min(1),
  aspectRatio: z.literal("9:16"),
  resolution: z.literal("1080x1920"),
  frameRate: z.literal(30),
  videoCodec: z.literal("H.264"),
  audioCodec: z.literal("AAC"),
  captionMode: z.literal("burned-in kinetic captions"),
  deliveryMode: z.literal("export-only"),
  postingEnabled: z.literal(false),
}).strict();

export const PlannedAssetSchema = z.object({
  slotId: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(["reused", "missing"]),
  sourceUrl: z.string().url().optional(),
  sourceMoment: SourceMomentSchema.optional(),
}).strict();

export const PlannedShotSchema = RecipeShotSchema.extend({
  duration: z.number().positive(),
  route: z.object({
    mode: z.enum(["editorial_still", "continuity_image", "paired_frame_video", "blocked"]),
    routeName: z.string().min(1),
    model: z.string().min(1),
    estimatedCostUsd: z.number().nonnegative(),
    reason: z.string().min(1),
  }).strict(),
  reusedAssetSlots: z.array(z.string()),
  missingKeyframes: z.array(z.string()),
  gateStatus: z.enum(["pass", "planned", "blocked"]),
  motionIntent: z.enum(["biological_motion", "editorial_motion", "intentional_hold"]),
  soundDesign: SoundDesignCueSchema,
  narrationTiming: z.object({
    wordCount: z.number().int().nonnegative(),
    estimatedSpeechSeconds: z.number().nonnegative(),
    availableShotSeconds: z.number().positive(),
    remainingVisualSeconds: z.number(),
    status: z.enum(["fits_estimate", "needs_trimming"]),
  }).strict(),
  review: ReviewFeedbackSchema,
}).strict();

export const GenerationJobSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["continuity_image", "paired_frame_video"]),
  routeName: z.string().min(1),
  model: z.string().min(1),
  shotId: z.string().min(1).optional(),
  assetSlotId: z.string().min(1).optional(),
  plannedDurationSeconds: z.number().positive().optional(),
  estimatedCostPerSecondUsd: z.number().nonnegative().optional(),
  estimatedCostUsd: z.number().nonnegative(),
}).strict();

export const EpisodePlanSchema = z.object({
  recipeId: z.literal(EPISODE_RECIPE_ID),
  status: z.enum(["ready", "needs_research"]),
  topicQuery: z.string().min(1),
  topicId: z.string().optional(),
  topicName: z.string().optional(),
  scientificName: z.string().optional(),
  sources: z.array(TopicSourceSchema),
  targetDuration: z.literal(EPISODE_TARGET_SECONDS),
  allowedDuration: z.object({ min: z.literal(EPISODE_MIN_SECONDS), max: z.literal(EPISODE_MAX_SECONDS) }).strict(),
  totalDuration: z.number().nonnegative(),
  plannerRoute: z.object({
    routeName: z.string().min(1),
    model: z.string().min(1),
    escalationRequired: z.boolean(),
    reason: z.string().min(1),
  }).strict(),
  narratorProfile: NarratorProfileSchema,
  narrationTiming: z.object({
    wordCount: z.number().int().nonnegative(),
    targetWordsPerMinute: z.number().int().positive(),
    estimatedSpeechSeconds: z.number().nonnegative(),
    reservedPauseSeconds: z.number().nonnegative(),
    estimatedTotalSeconds: z.number().nonnegative(),
    remainingVisualSeconds: z.number(),
    availableSpeechSeconds: z.number().nonnegative(),
    maxWordsAtTargetPace: z.number().int().nonnegative(),
    status: z.enum(["fits_estimate", "needs_trimming"]),
    readyToRecord: z.literal(false),
    note: z.string().min(1),
  }).strict(),
  exportProfiles: z.array(ExportProfileSchema).length(3),
  motionCoverage: z.object({
    biologicalMotionShots: z.number().int().nonnegative(),
    editorialMotionShots: z.number().int().nonnegative(),
    intentionalHoldShots: z.number().int().nonnegative(),
    movingShotPercent: z.number().min(0).max(100),
    rationale: z.string().min(1),
  }).strict(),
  source: z.object({
    contentId: z.string().min(1),
    plantName: z.string().min(1),
    compatible: z.boolean(),
    reusedAssetCount: z.number().int().nonnegative(),
  }).strict().optional(),
  assets: z.array(PlannedAssetSchema),
  shots: z.array(PlannedShotSchema),
  gates: z.array(GateResultSchema),
  generationJobs: z.array(GenerationJobSchema),
  estimates: z.object({
    paidGenerationCount: z.number().int().nonnegative(),
    continuityImageCount: z.number().int().nonnegative(),
    pairedFrameVideoCount: z.number().int().nonnegative(),
    totalCostUsd: z.number().nonnegative(),
  }).strict(),
  rules: z.object({
    captions: z.literal("single-track, one-to-three-word phrases"),
    typography: z.literal("no headers or watermarks"),
    motion: z.literal("paired start/end frames for biological actions"),
    loop: z.literal("final endpoint matches opening frame"),
  }).strict(),
}).strict();

export type BiologicalAction = z.infer<typeof BiologicalActionSchema>;
export type RecipeShot = z.infer<typeof RecipeShotSchema>;
export type TopicDefinition = z.infer<typeof TopicDefinitionSchema>;
export type EpisodeCompilerInput = z.infer<typeof EpisodeCompilerInputSchema>;
export type EpisodeRouteConfig = z.infer<typeof EpisodeRouteConfigSchema>;
export type EpisodePlan = z.infer<typeof EpisodePlanSchema>;
export type ReviewFeedback = z.infer<typeof ReviewFeedbackSchema>;
