import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";
import { mergeCost } from "../_shared/cost.ts";
import { stitchCost } from "../_shared/pricing.ts";

interface Step {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeadersFor(req) });

    const corsHeaders = corsHeadersFor(req);
    const __auth = await requireAuthorized(req);
    if (!__auth.ok) return __auth.response;

  try {
    const { row_id } = await req.json();
    if (!row_id) throw new Error("Missing row_id");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY")!;
    if (!LOVABLE_API_KEY || !REPLICATE_API_KEY) throw new Error("Replicate connector not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: row, error: fetchErr } = await supabase
      .from("botanical_animated")
      .select("id, clip_urls, progress, plant_name")
      .eq("id", row_id)
      .single();
    if (fetchErr || !row) throw new Error("Row not found");

    const clips: string[] = (row.clip_urls ?? []).filter(Boolean);
    if (clips.length !== 6) throw new Error(`Expected 6 clips, got ${clips.length}`);

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
        const GW = "https://connector-gateway.lovable.dev/replicate/v1";

        // Use fofr/video-concat (official) — accepts videos[] of URLs, returns mp4.
        const createRes = await fetch(`${GW}/models/fofr/video-concat/predictions`, {
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
          throw new Error(`Concat create failed ${createRes.status}: ${txt.slice(0, 300)}`);
        }
        const pred = await createRes.json();
        const predId = pred.id;

        // Poll up to ~5 min.
        let outputUrl: string | null = null;
        for (let i = 0; i < 100; i++) {
          await new Promise((r) => setTimeout(r, 3000));
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
            throw new Error(`Concat ${p.status}: ${p.error ?? ""}`);
          }
        }
        if (!outputUrl) throw new Error("Concat timed out");

        // Mark stitch done, save running.
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

        // Download MP4 and upload to bucket.
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

        await mergeCost(supabase, row_id, "stitch", stitchCost());

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
        await supabase
          .from("botanical_animated")
          .update({ queue_status: "error", error: `stitch: ${msg}` })
          .eq("id", row_id);
      }
    };

    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(bg());
    } else {
      bg();
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
