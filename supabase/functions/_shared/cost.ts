// Merge a per-stage cost patch onto botanical_animated.cost_breakdown and
// recompute cost_usd as the sum of every stage's total_usd. Read-modify-write
// so concurrent stages don't clobber each other's fields.
// The final apply goes through guarded_update_animated so a stopped or
// terminal run cannot be silently advanced by a straggling provider call.
import { guardedUpdateAnimated } from "./guardedUpdate.ts";
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
    .select("cost_breakdown, queue_status, stop_requested_at")
    .eq("id", rowId)
    .single();
  if (error || !row) {
    console.warn("mergeCost: failed to load row", rowId, error?.message);
    return;
  }
  // Don't advance the visible cost of a stopped/terminal run — cost merge
  // must never override a Stop.
  if (row.stop_requested_at || ["canceled", "error", "done"].includes(row.queue_status)) {
    console.log(`mergeCost: skip ${stage} on ${rowId} (${row.queue_status})`);
    return;
  }
  const current = (row.cost_breakdown ?? {}) as Record<string, { total_usd?: number }>;
  const next = { ...current, [stage]: patch };
  const total = Object.values(next).reduce(
    (sum, v) => sum + (typeof v?.total_usd === "number" ? v.total_usd : 0),
    0,
  );
  const applied = await guardedUpdateAnimated(supabase, rowId, {
    cost_breakdown: next,
    cost_usd: (+total.toFixed(4)).toString(),
  });
  if (!applied) console.log(`mergeCost: guarded update rejected for ${rowId}`);
}
