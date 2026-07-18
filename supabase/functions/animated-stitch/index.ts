import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";
import { mergeCost } from "../_shared/cost.ts";
import { stitchCost } from "../_shared/pricing.ts";
import { claimJob, isStopped, updateJob } from "../_shared/providerJobs.ts";

interface Step {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
}

const CONCAT_MODEL = "fofr/video-concat";

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
    const { row_id } = await req.json();
    if (!row_id) return json({ error: "Missing row_id" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY")!;
    if (!LOVABLE_API_KEY || !REPLICATE_API_KEY) throw new Error("Replicate connector not configured");

    const supabase = createClient(SUPABASE_URL, SERVICE);

    const { data: row, error: fetchErr } = await supabase
      .from("botanical_animated")
      .select("id, clip_urls, progress, stop_requested_at, queue_status")
      .eq("id", row_id)
      .single();
    if (fetchErr || !row) return json({ error: "Row not found" }, 404);
    if (row.stop_requested_at || ["canceled", "done", "error"].includes(row.queue_status)) {
      return json({ error: `Row is ${row.queue_status}` }, 409);
    }

    const clips: string[] = (row.clip_urls ?? []).filter(Boolean);
    if (clips.length !== 6) return json({ error: `Expected 6 clips, got ${clips.length}` }, 409);

    const baseSteps: Step[] = (row.progress?.steps as Step[]) ?? [];
    const markStitchRunning = baseSteps.map((s) =>
      s.key === "stitch" ? { ...s, status: "running" as const } : s,
    );

    await supabase
      .from("botanical_animated")
      .update({
        queue_status: "stitching",
        progress: { stage: "stitch", steps: markStitchRunning },
      })
      .eq("id", row_id);

    const bg = async () => {
      try {
        if (await isStopped(supabase, row_id)) return;
        const GW = "https://connector-gateway.lovable.dev/replicate/v1";
        const claim = await claimJob(supabase, row_id, "stitch", "replicate", CONCAT_MODEL);
        const job = claim.job;
        let predId = job.prediction_id ?? null;

        if (job.status === "succeeded" && job.output_url) {
          // Nothing to do; existing output_url will be re-uploaded below via the
          // usual path. To keep it simple, force a fresh submit only if no id.
          predId = job.prediction_id;
        }

        if (claim.claimed || !predId) {
          if (await isStopped(supabase, row_id)) return;
          await updateJob(supabase, job.id, { status: "submitting" });
          const createRes = await fetch(`${GW}/models/${CONCAT_MODEL}/predictions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": REPLICATE_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ input: { videos: clips } }),
          });
          if (!createRes.ok) {
            const txt = await createRes.text();
            await updateJob(supabase, job.id, { status: "failed", error: `create ${createRes.status}: ${txt.slice(0, 240)}` });
            throw new Error(`Concat create failed ${createRes.status}: ${txt.slice(0, 240)}`);
          }
          const pred = await createRes.json();
          predId = pred.id;
          await updateJob(supabase, job.id, { status: "running", prediction_id: predId });
        } else {
          await updateJob(supabase, job.id, { status: "running" });
        }

        let outputUrl: string | null = null;
        for (let i = 0; i < 100; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          if (await isStopped(supabase, row_id)) {
            await updateJob(supabase, job.id, { status: "canceled", error: "stopped mid-poll" });
            return;
          }
          const pollRes = await fetch(`${GW}/predictions/${predId}`, {
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": REPLICATE_API_KEY,
            },
          });
          if (!pollRes.ok) continue;
          const p = await pollRes.json();
          if (p.status === "succeeded") {
            outputUrl = Array.isArray(p.output) ? p.output[0] : p.output;
            break;
          }
          if (p.status === "failed" || p.status === "canceled") {
            await updateJob(supabase, job.id, { status: p.status, error: p.error ?? null });
            throw new Error(`Concat ${p.status}: ${p.error ?? ""}`);
          }
        }
        if (!outputUrl) {
          await updateJob(supabase, job.id, { status: "expired", error: "poll timeout" });
          throw new Error("Concat timed out");
        }

        if (await isStopped(supabase, row_id)) return;
        await supabase
          .from("botanical_animated")
          .update({
            progress: {
              stage: "save",
              steps: baseSteps.map((s) => {
                if (s.key === "stitch") return { ...s, status: "done" as const };
                if (s.key === "save") return { ...s, status: "running" as const };
                return s;
              }),
            },
          })
          .eq("id", row_id);

        const mp4Res = await fetch(outputUrl);
        if (!mp4Res.ok) throw new Error(`Download failed: ${mp4Res.status}`);
        const mp4Bytes = new Uint8Array(await mp4Res.arrayBuffer());
        const path = `animated/${row_id}/final.mp4`;
        const { error: upErr } = await supabase.storage
          .from("botanical-faceless-visuals")
          .upload(path, mp4Bytes, { contentType: "video/mp4", upsert: true });
        if (upErr) throw new Error(`Upload: ${upErr.message}`);
        const { data: pub } = supabase.storage
          .from("botanical-faceless-visuals")
          .getPublicUrl(path);

        await updateJob(supabase, job.id, { status: "succeeded", output_url: pub.publicUrl });
        await mergeCost(supabase, row_id, "stitch", stitchCost());

        if (await isStopped(supabase, row_id)) return;
        await supabase
          .from("botanical_animated")
          .update({
            queue_status: "done",
            final_video_url: pub.publicUrl,
            progress: {
              stage: "done",
              steps: baseSteps.map((s) => {
                if (s.key === "stitch" || s.key === "save") return { ...s, status: "done" as const };
                return s;
              }),
            },
          })
          .eq("id", row_id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("animated-stitch bg error:", msg);
        if (!(await isStopped(supabase, row_id))) {
          await supabase
            .from("botanical_animated")
            .update({ queue_status: "error", error: `stitch: ${msg}` })
            .eq("id", row_id);
        }
      }
    };

    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(bg());
    } else {
      bg();
    }

    return json({ success: true }, 202);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ success: false, error: msg }, 500);
  }
});
