import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORDER = ["hook", "dangle_1", "rehook", "dangle_2", "verified_truth", "close"] as const;
type Moment = (typeof ORDER)[number];

const MOTION_BY_MOMENT: Record<Moment, string> = {
  hook: "Slowly reveal the botanical specimen emerging from darkness, gentle rise as if growing into frame, soft volumetric light shifting across the surface, organic forward motion.",
  dangle_1: "Tight macro slow zoom along the surface texture, fibers shifting subtly, dew or particles drifting, shallow focus breathing.",
  rehook: "The diagonal specimen pushes dramatically across the frame, slow rotation in place, dust motes catching light, deep parallax depth.",
  dangle_2: "Cross-section halves slowly separate revealing internal anatomy, magnified tissue circles drift, callout annotations gently appear, top-down camera holds.",
  verified_truth: "Separated specimen parts arrange themselves across the evidence board, labels A B C D softly settle into place, measurement brackets extend, calm authoritative reveal.",
  close: "The single small specimen rotates one quiet turn, golden-ratio diagram softly traces around it, dust settles, final breath of stillness.",
};

interface AnimatedRow {
  id: string;
  source_content_id: string | null;
  still_urls: string[];
  progress: { stage?: string; steps?: Array<{ key: string; status: string; detail?: string }> };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { row_id } = await req.json();
    if (!row_id) throw new Error("Missing row_id");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY")!;
    if (!LOVABLE_API_KEY || !REPLICATE_API_KEY) throw new Error("Replicate connector not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: row, error: fetchError } = await supabase
      .from("botanical_animated")
      .select("id, source_content_id, still_urls, progress, script")
      .eq("id", row_id)
      .single();
    if (fetchError || !row) throw new Error("Row not found");

    const stills: string[] = (row as AnimatedRow & { script: Record<string, string> }).still_urls ?? [];
    if (stills.length !== 6 || stills.some((s) => !s)) throw new Error("Stills not ready");

    const script = row.script as Record<string, string> | null;

    // Mark clips stage running.
    const STEPS = [
      { key: "script", label: "Picking plant + writing script", status: "done" as const, detail: row.progress?.steps?.find((s) => s.key === "script")?.detail },
      { key: "stills", label: "Designing 6 hero stills (OpenAI gpt-image-2)", status: "done" as const, detail: "6 / 6" },
      { key: "clips", label: "Animating 6 clips (Kling v2.1, 10s each)", status: "running" as const, detail: "0 / 6", started_at: new Date().toISOString() },
      { key: "stitch", label: "Stitching final 60s video", status: "pending" as const },
      { key: "save", label: "Saving to library", status: "pending" as const },
    ];
    await supabase
      .from("botanical_animated")
      .update({ queue_status: "animating", clip_urls: new Array(6).fill(""), progress: { stage: "clips", steps: STEPS } })
      .eq("id", row_id);

    // Background: animate clips with concurrency 2.
    const bg = async () => {
      const GW = "https://connector-gateway.lovable.dev/replicate/v1";
      const clipUrls: string[] = new Array(6).fill("");
      let doneCount = 0;

      const animateOne = async (idx: number) => {
        const moment = ORDER[idx];
        const stillUrl = stills[idx];
        const scriptLine = script?.[moment === "verified_truth" ? "verified_truth" : moment] ?? "";
        const motion = MOTION_BY_MOMENT[moment];
        const prompt = `${motion} ${scriptLine}`.slice(0, 1500);

        try {
          // Create prediction.
          const createRes = await fetch(`${GW}/models/kwaivgi/kling-v2.1/predictions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": REPLICATE_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              input: {
                start_image: stillUrl,
                prompt,
                duration: 10,
                negative_prompt: "blurry, low quality, distorted, text artifacts, watermark, logo, frame border",
              },
            }),
          });
          if (!createRes.ok) {
            const txt = await createRes.text();
            throw new Error(`Kling create failed ${createRes.status}: ${txt.slice(0, 200)}`);
          }
          const pred = await createRes.json();
          const predId = pred.id;

          // Poll up to 8 minutes.
          let outputUrl: string | null = null;
          for (let i = 0; i < 160; i++) {
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
              throw new Error(`Kling ${p.status}: ${p.error ?? ""}`);
            }
          }
          if (!outputUrl) throw new Error("Kling timed out");

          // Download MP4 and upload to bucket.
          const mp4Res = await fetch(outputUrl);
          if (!mp4Res.ok) throw new Error(`Download failed: ${mp4Res.status}`);
          const mp4Bytes = new Uint8Array(await mp4Res.arrayBuffer());
          const path = `animated/${row_id}/clip_${idx}_${moment}.mp4`;
          const { error: upErr } = await supabase.storage
            .from("botanical-faceless-visuals")
            .upload(path, mp4Bytes, { contentType: "video/mp4", upsert: true });
          if (upErr) throw new Error(`Upload: ${upErr.message}`);
          const { data: pub } = supabase.storage.from("botanical-faceless-visuals").getPublicUrl(path);
          clipUrls[idx] = pub.publicUrl;
          doneCount++;

          // Push update.
          await supabase
            .from("botanical_animated")
            .update({
              clip_urls: clipUrls,
              progress: {
                stage: "clips",
                steps: STEPS.map((s) =>
                  s.key === "clips"
                    ? { ...s, status: doneCount === 6 ? "done" : "running", detail: `${doneCount} / 6` }
                    : s,
                ),
              },
            })
            .eq("id", row_id);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Clip ${idx} (${moment}) failed:`, msg);
          await supabase
            .from("botanical_animated")
            .update({ queue_status: "error", error: `Clip ${moment}: ${msg}` })
            .eq("id", row_id);
          throw err;
        }
      };

      // Run with concurrency 2.
      const queue = [0, 1, 2, 3, 4, 5];
      const runners = [0, 1].map(async () => {
        while (queue.length > 0) {
          const idx = queue.shift();
          if (idx === undefined) break;
          await animateOne(idx);
        }
      });
      try {
        await Promise.all(runners);
      } catch {
        return; // error already recorded
      }

      // All 6 clips ready — mark ready for client-side stitch.
      await supabase
        .from("botanical_animated")
        .update({
          queue_status: "clips_done",
          progress: {
            stage: "stitch_ready",
            steps: STEPS.map((s) =>
              s.key === "clips" ? { ...s, status: "done" as const, detail: "6 / 6" } : s,
            ),
          },
        })
        .eq("id", row_id);
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
