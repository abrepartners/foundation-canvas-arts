import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";

const ORDER = ["hook", "dangle_1", "rehook", "dangle_2", "verified_truth", "close"] as const;
type Moment = (typeof ORDER)[number];

// Locked motion library — each choreography follows Kling v2.1's recommended
// prompt shape: [Subject + action] + [Camera motion] + [Scene/atmosphere].
// Composition is anchored by start_image; we NEVER include narration text
// (Kling would try to render spoken words as on-screen captions).
// See mem://reference/kling-v21 for the field-adoption rationale.
const MOTION_BY_MOMENT: Record<Moment, string> = {
  hook:
    "Subject and framing remain identical to the reference frame. A single botanical specimen slowly emerges upward from soft dark soil at the bottom of the frame, leaves gently unfurling as it rises. Static camera locked on a tripod — no zoom, no pan, no rotation. Warm rim-light drifts softly from left to right across the surface while fine dust motes float upward through the beam. Ten seconds. End on quiet stillness.",
  dangle_1:
    "Subject and framing remain identical to the reference frame. Extreme botanical macro. A slow, subtle push-in along the surface texture over ten seconds, with shallow depth of field breathing in and out once. A few tiny dust or pollen particles drift diagonally across the light. No pan, no rotation, no reveal of the wider plant. Warm directional light, still air, museum quiet.",
  rehook:
    "Subject and framing remain identical to the reference frame. The specimen holds its diagonal pose across the frame and does not rotate or morph. Over ten seconds the camera performs a slow horizontal truck left to right for a gentle parallax reveal against the hazy background. The key light shifts slightly so shadows lengthen. No zoom, no subject rotation, no new elements. End near the original composition.",
  dangle_2:
    "Subject and framing remain identical to the reference frame. Overhead dissection view of two cross-section halves. Over ten seconds the two halves gently separate along the horizontal axis, revealing a thin sliver more of internal anatomy in the gap. Faint magnifier circles softly pulse in scale once. Overhead lock — no pan, no zoom, no rotation. No new specimens appear.",
  verified_truth:
    "Subject and framing remain identical to the reference frame. Overhead labeled evidence board with parts A, B, C, D already in place on aged parchment. Over ten seconds each label settles with a tiny correction motion, and thin measurement bracket lines extend outward from each part as if drawing themselves onto the parchment. Overhead lock — no zoom, no pan, no rotation. No new parts appear, no text morphs.",
  close:
    "Subject and framing remain identical to the reference frame. A single small centered specimen surrounded by generous negative space. Over ten seconds the specimen performs a single slow quarter-turn in place — never a full spin — while a thin golden-ratio spiral softly traces itself around it as a line drawing. A subtle vignette closes gently at the corners. Static camera. End on complete stillness.",
};

const NEGATIVE_PROMPT =
  "text, letters, captions, subtitles, watermark, logo, borders, " +
  "morphing subject, species change, extra plants, human hands, people, " +
  "jump cut, whip pan, camera shake, rapid zoom, style change, cartoon, " +
  "oversaturation, blur, low quality";

interface AnimatedRow {
  id: string;
  source_content_id: string | null;
  still_urls: string[];
  progress: { stage?: string; steps?: Array<{ key: string; status: string; detail?: string }> };
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
        // Motion prompt is composition-locked to this moment's still. We do NOT
        // append the script narration — Kling would try to render the words.
        const prompt = MOTION_BY_MOMENT[moment];

        try {
          // Kling v2.1 image-to-video input. See mem://reference/kling-v21.
          const klingInput = {
            start_image: stillUrl,
            prompt,
            negative_prompt: NEGATIVE_PROMPT,
            duration: 10,           // 5 | 10
            aspect_ratio: "9:16",   // matches vertical stills
            cfg_scale: 0.5,         // 0–1, balances prompt vs. image fidelity
            mode: "pro",            // std | pro
          };
          if (idx === 0) {
            console.log("kling input sample:", JSON.stringify(klingInput));
          }
          // Create prediction.
          const createRes = await fetch(`${GW}/models/kwaivgi/kling-v2.1/predictions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "X-Connection-Api-Key": REPLICATE_API_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ input: klingInput }),
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

      // All 6 clips ready — kick off server-side stitch.
      await supabase
        .from("botanical_animated")
        .update({
          queue_status: "stitching",
          progress: {
            stage: "stitch",
            steps: STEPS.map((s) => {
              if (s.key === "clips") return { ...s, status: "done" as const, detail: "6 / 6" };
              if (s.key === "stitch") return { ...s, status: "running" as const };
              return s;
            }),
          },
        })
        .eq("id", row_id);

      // Fire-and-forget invocation of animated-stitch.
      supabase.functions
        .invoke("animated-stitch", { body: { row_id } })
        .catch((e) => console.error("animated-stitch invoke error:", e));
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
