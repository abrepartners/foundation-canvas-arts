// Guarded update helper. Wraps the guarded_update_animated SQL RPC so a
// patch is applied ONLY when the row is not stopped and not terminal. Use
// this after every await in long-running background tasks so a late Stop
// cannot be silently overwritten. Returns true when the patch was applied.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SB = any;

export async function guardedUpdateAnimated(
  supabase: SB,
  rowId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch: Record<string, any>,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("guarded_update_animated", {
    _row_id: rowId,
    _patch: patch,
  });
  if (error) {
    console.warn(`guarded_update_animated failed (${rowId}):`, error.message);
    return false;
  }
  return data === true;
}
