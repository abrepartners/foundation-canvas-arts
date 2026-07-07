## Add stop + unblock the picker on `/animated`

The picker and "Animate this one" button are gated on `isRunning`, so once a run starts you can't switch sources. Fix both problems:

### Changes to `src/pages/Animated.tsx`

1. **Enable the picker and start buttons at all times.** Remove `isRunning` from the `disabled` predicate on "Choose source", "Animate this one", and "Generate fresh". Keep `isStarting` (the in-flight invoke) as the only guard. Starting a new run creates a new `botanical_animated` row and the UI swaps to it.
2. **Add a "Stop" button** shown only when `isRunning`, sitting next to "Generate fresh":
   - Optimistically clears `row` from local state and resets `animateTriggered.current = null` so the picker becomes the primary surface again.
   - Writes `{ queue_status: "canceled", error: "Canceled by user" }` to that row so the sidebar/history reflects the state.
   - Toast: "Stopped — you can pick another source or generate fresh."
3. **Rename button copy** for clarity: label the primary button "Generate fresh" (already done) and label the picker CTA "Animate selected".

### Honest limitation (called out in a small helper line under the buttons)

Kling predictions already dispatched keep running on Replicate's side — we can't recall those credits. Stopping just detaches the UI and marks the row canceled so the pipeline's later updates don't fight your new run. No new run is blocked by the old one.

### Out of scope

- Cancelling in-flight Replicate predictions (would need to track prediction ids per clip and hit the cancel endpoint; separate change).
- Edge functions checking `queue_status === "canceled"` mid-loop to bail early — nice-to-have follow-up, not needed to unblock the picker.
- Any change to the pipeline, prompts, or DB schema.

### Files touched

- `src/pages/Animated.tsx` only.
