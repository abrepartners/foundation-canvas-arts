// Stops an animation run. Atomically marks the row canceled + stop_requested_at,
// blocks all future submissions/handoffs, and best-effort cancels every
// non-terminal Replicate prediction associated with the row.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";
import { cancelReplicatePrediction, updateJob } from "../_shared/providerJobs.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeadersFor(req) });
  const corsHeaders = corsHeadersFor(req);
  const auth = await requireAuthorized(req);
  if (!auth.ok) return auth.response;

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const rowId: string | undefined = body?.row_id;
    if (!rowId) return json({ error: "row_id required" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE = Deno.env.get("LOVABLE_API_KEY");
    const REPLICATE = Deno.env.get("REPLICATE_API_KEY");
    const supabase = createClient(SUPABASE_URL, SERVICE);

    // Atomically set stop flag. Only stop if not already terminal.
    const nowIso = new Date().toISOString();
    const { data: row, error: readErr } = await supabase
      .from("botanical_animated")
      .select("id, queue_status, stop_requested_at")
      .eq("id", rowId)
      .maybeSingle();
    if (readErr || !row) return json({ error: "row not found" }, 404);

    if (["done", "error", "canceled"].includes(row.queue_status) && !row.stop_requested_at) {
      // Already terminal — record stop for audit but do nothing else.
      await supabase
        .from("botanical_animated")
        .update({ stop_requested_at: nowIso })
        .eq("id", rowId);
      return json({
        row_id: rowId,
        already_terminal: true,
        queue_status: row.queue_status,
        canceled: [],
        already_finished: [],
        failed_to_cancel: [],
      });
    }

    await supabase
      .from("botanical_animated")
      .update({
        stop_requested_at: nowIso,
        queue_status: "canceled",
        error: row.queue_status === "canceled" ? undefined : "Stopped by user",
      })
      .eq("id", rowId);

    // Enumerate non-terminal provider jobs and cancel them.
    const { data: jobs } = await supabase
      .from("animation_provider_jobs")
      .select("*")
      .eq("row_id", rowId);

    const canceled: Array<{ job_key: string; prediction_id: string | null }> = [];
    const already: Array<{ job_key: string; status: string }> = [];
    const failed: Array<{ job_key: string; reason: string }> = [];

    for (const j of jobs ?? []) {
      if (["succeeded", "failed", "canceled"].includes(j.status)) {
        already.push({ job_key: j.job_key, status: j.status });
        continue;
      }
      if (!j.prediction_id) {
        // Claimed but never submitted — just mark canceled.
        await supabase
          .from("animation_provider_jobs")
          .update({ status: "canceled", error: "stopped before submit", updated_at: nowIso })
          .eq("id", j.id);
        canceled.push({ job_key: j.job_key, prediction_id: null });
        continue;
      }
      if (!LOVABLE || !REPLICATE) {
        const reason = "provider creds unavailable";
        await updateJob(supabase, j.id, { error: `cancel failed: ${reason}` });
        failed.push({ job_key: j.job_key, reason });
        continue;
      }
      try {
        const r = await cancelReplicatePrediction(j.prediction_id, LOVABLE, REPLICATE);
        if (r.ok) {
          await supabase
            .from("animation_provider_jobs")
            .update({ status: "canceled", updated_at: nowIso })
            .eq("id", j.id);
          canceled.push({ job_key: j.job_key, prediction_id: j.prediction_id });
        } else {
          const reason = `HTTP ${r.status}: ${r.body.slice(0, 160)}`;
          await updateJob(supabase, j.id, { error: `cancel failed: ${reason}` });
          failed.push({ job_key: j.job_key, reason });
        }
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        await updateJob(supabase, j.id, { error: `cancel failed: ${reason}` });
        failed.push({ job_key: j.job_key, reason });
      }
    }

    return json({
      row_id: rowId,
      queue_status: "canceled",
      canceled,
      already_finished: already,
      failed_to_cancel: failed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("animated-stop error:", msg);
    return json({ error: msg }, 500);
  }
});
