// Replicate list prices (USD). Single source of truth — update PRICING_VERSION
// whenever any published price changes so the client-server cost confirmation
// handshake fails-fast on stale confirmations.
export const PRICING_VERSION = "2026-07-17-b";

export const PRICING = {
  "black-forest-labs/flux-1.1-pro": { unit_usd: 0.04 },
  "openai/gpt-image-2": { unit_usd: 0.128 },
  "kwaivgi/kling-v2.1": { std_usd_per_sec: 0.05, pro_usd_per_sec: 0.09 },
  "fofr/video-concat": { flat_usd: 0.02 },
} as const;

export const STILL_PRICING_VERSION = "2026-08-17-a";
export const STILL_PROMPT_VERSION = "botanical-study-plate-v1";
export const STILL_IMAGE_COUNT = 6;
export const STILL_TEXT_RESERVE_USD = 0.05;
export const STILL_PER_RUN_LIMIT_USD = 1;
export const STILL_DAILY_LIMIT_USD = 5;

export type StillImageProvider = "replicate" | "openai";

export function stillPackageQuote(provider: StillImageProvider) {
  const model = provider === "openai"
    ? "openai/gpt-image-2"
    : "black-forest-labs/flux-1.1-pro";
  const imageUnitUsd = PRICING[model].unit_usd;
  const imagesUsd = +(imageUnitUsd * STILL_IMAGE_COUNT).toFixed(4);
  return {
    image_provider: provider,
    model,
    image_count: STILL_IMAGE_COUNT,
    image_unit_usd: imageUnitUsd,
    images_usd: imagesUsd,
    text_model: "google/gemini-2.5-flash",
    text_reserve_usd: STILL_TEXT_RESERVE_USD,
    estimated_cost_usd: +(imagesUsd + STILL_TEXT_RESERVE_USD).toFixed(4),
    prompt_version: STILL_PROMPT_VERSION,
    pricing_version: STILL_PRICING_VERSION,
    per_run_limit_usd: STILL_PER_RUN_LIMIT_USD,
    daily_limit_usd: STILL_DAILY_LIMIT_USD,
  };
}

// Fixed animation shape used by animated-animate-all: 6 clips × 10s in Kling
// v2.1 Pro, plus one stitch. Any change requires bumping PRICING_VERSION.
export const ANIMATION_CLIP_COUNT = 6;
export const ANIMATION_CLIP_SECONDS = 10;
export const ANIMATION_MODE: "pro" | "std" = "pro";
export const MAX_PROVIDER_ATTEMPTS = 3;

export function stillsCost(count: number) {
  const unit = PRICING["openai/gpt-image-2"].unit_usd;
  return {
    model: "openai/gpt-image-2",
    count,
    unit_usd: unit,
    total_usd: +(unit * count).toFixed(4),
  };
}

export function clipsCost(count: number, seconds: number, mode: "std" | "pro") {
  const unit =
    mode === "pro"
      ? PRICING["kwaivgi/kling-v2.1"].pro_usd_per_sec
      : PRICING["kwaivgi/kling-v2.1"].std_usd_per_sec;
  const totalSeconds = count * seconds;
  return {
    model: "kwaivgi/kling-v2.1",
    mode,
    count,
    seconds_per_clip: seconds,
    total_seconds: totalSeconds,
    unit_usd_per_sec: unit,
    total_usd: +(unit * totalSeconds).toFixed(4),
  };
}

export function stitchCost() {
  return {
    model: "fofr/video-concat",
    total_usd: PRICING["fofr/video-concat"].flat_usd,
  };
}

// Total paid cost of the animation stage the user must confirm before we
// submit any Kling/stitch jobs. Excludes stills (already paid or reused).
export function paidAnimationEstimate() {
  const clips = clipsCost(ANIMATION_CLIP_COUNT, ANIMATION_CLIP_SECONDS, ANIMATION_MODE);
  const stitch = stitchCost();
  return {
    pricing_version: PRICING_VERSION,
    clips,
    stitch,
    total_usd: +(clips.total_usd + stitch.total_usd).toFixed(4),
    max_attempts: MAX_PROVIDER_ATTEMPTS,
    retry_ceiling_usd: +(
      (clips.total_usd + stitch.total_usd) * MAX_PROVIDER_ATTEMPTS
    ).toFixed(4),
  };
}
