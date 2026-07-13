// Replicate list prices (USD). Single source of truth — update here when
// provider pricing changes. Values reflect published list prices at time of
// writing; treat outputs as estimates.
export const PRICING = {
  "openai/gpt-image-2": { unit_usd: 0.19 },
  "kwaivgi/kling-v2.1": { std_usd_per_sec: 0.08, pro_usd_per_sec: 0.28 },
  "fofr/video-concat": { flat_usd: 0.02 },
} as const;

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
