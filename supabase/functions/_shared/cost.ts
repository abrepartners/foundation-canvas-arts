// Merge a per-stage cost patch onto botanical_animated.cost_breakdown and
// recompute cost_usd as the sum of every stage's total_usd. Read-modify-write
// so concurrent stages don't clobber each other's fields.
// deno-lint-ignore no-explicit-any
type SB = any;

export async function mergeCost(
  supabase: SB,
  rowId: string,
  stage: "stills" | "clips" | "stitch",
  // deno-lint-ignore no-explicit-any
  patch: Record<string, any>,
) {
  const { data: row, error } = await supabase
    .from("botanical_animated")
    .select("cost_breakdown")
    .eq("id", rowId)
    .single();
  if (error || !row) {
    console.warn("mergeCost: failed to load row", rowId, error?.message);
    return;
  }
  const current = (row.cost_breakdown ?? {}) as Record<string, { total_usd?: number }>;
  const next = { ...current, [stage]: patch };
  const total = Object.values(next).reduce(
    (sum, v) => sum + (typeof v?.total_usd === "number" ? v.total_usd : 0),
    0,
  );
  const { error: upErr } = await supabase
    .from("botanical_animated")
    .update({ cost_breakdown: next, cost_usd: +total.toFixed(4) })
    .eq("id", rowId);
  if (upErr) console.warn("mergeCost: update failed", upErr.message);
}
