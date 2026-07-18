// Replicate list prices (USD). Single source of truth — update PRICING_VERSION
// whenever any published price changes so the client-server cost confirmation
// handshake fails-fast on stale confirmations.
export const PRICING_VERSION = "2026-07-17-a";

export const PRICING = {
  "openai/gpt-image-2": { unit_usd: 0.19 },
  "kwaivgi/kling-v2.1": { std_usd_per_sec: 0.08, pro_usd_per_sec: 0.28 },
  "fofr/video-concat": { flat_usd: 0.02 },
} as const;

// Fixed animation shape used by animated-animate-all: 6 clips × 10s in Kling
// v2.1 Pro, plus one stitch. Any change requires bumping PRICING_VERSION.
export const ANIMATION_CLIP_COUNT = 6;
export const ANIMATION_CLIP_SECONDS = 10;
export const ANIMATION_MODE: "pro" | "std" = "pro";

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
  };
}
