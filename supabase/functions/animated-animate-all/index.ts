import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";
import { mergeCost } from "../_shared/cost.ts";
import {
  ANIMATION_CLIP_COUNT,
  ANIMATION_CLIP_SECONDS,
  ANIMATION_MODE,
  clipsCost,
  paidAnimationEstimate,
  PRICING_VERSION,
} from "../_shared/pricing.ts";
import { claimJob, isStopped, updateJob } from "../_shared/providerJobs.ts";

const ORDER = ["hook", "dangle_1", "rehook", "dangle_2", "verified_truth", "close"] as const;
type Moment = (typeof ORDER)[number];

// Locked motion library — unchanged. See mem://reference/kling-v21.
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

const KLING_MODEL = "kwaivgi/kling-v2.1";

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
    const row_id: string | undefined = body?.row_id;
    const confirmedEstimate: number | undefined =
      typeof body?.confirmed_estimate_usd === "number" ? body.confirmed_estimate_usd : undefined;
    const clientPricingVersion: string | undefined =
      typeof body?.pricing_version === "string" ? body.pricing_version : undefined;
    if (!row_id) return json({ error: "row_id required" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY")!;
    if (!LOVABLE_API_KEY || !REPLICATE_API_KEY) throw new Error("Replicate connector not configured");

    const supabase = createClient(SUPABASE_URL, SERVICE);

    // ------- Validate row + cost confirmation handshake --------
    const { data: row, error: fetchError } = await supabase
      .from("botanical_animated")
      .select("id, still_urls, progress, queue_status, stop_requested_at, cost_confirmed_estimate_usd, cost_confirmed_at, pricing_version")
      .eq("id", row_id)
      .single();
    if (fetchError || !row) return json({ error: "Row not found" }, 404);
    if (row.stop_requested_at) return json({ error: "Run was stopped" }, 409);
    if (row.queue_status === "canceled" || row.queue_status === "done") {
      return json({ error: `Row is ${row.queue_status}` }, 409);
    }
    if (row.queue_status === "animating" || row.queue_status === "stitching") {
      // Already running — idempotent success.
      return json({ success: true, resumed: true }, 200);
    }
    if (row.queue_status !== "stills_ready") {
      return json({ error: `Cannot animate from status ${row.queue_status}` }, 409);
    }

    const stills: string[] = row.still_urls ?? [];
    if (stills.length !== ANIMATION_CLIP_COUNT || stills.some((s: string) => !s)) {
      return json({ error: "Stills not ready" }, 409);
    }

    // Cost confirmation gate — server is the source of truth on pricing.
    const expected = paidAnimationEstimate();
    const alreadyConfirmed =
      row.cost_confirmed_at &&
      row.pricing_version === expected.pricing_version &&
      Math.abs(Number(row.cost_confirmed_estimate_usd ?? 0) - expected.total_usd) < 0.0001;

    if (!alreadyConfirmed) {
      if (
        clientPricingVersion !== expected.pricing_version ||
        typeof confirmedEstimate !== "number" ||
        Math.abs(confirmedEstimate - expected.total_usd) >= 0.0001
      ) {
        return json({
          error: "cost_confirmation_required",
          expected_total_usd: expected.total_usd,
          pricing_version: expected.pricing_version,
          breakdown: { clips: expected.clips, stitch: expected.stitch },
        }, 402);
      }
      await supabase
        .from("botanical_animated")
        .update({
          cost_confirmed_estimate_usd: expected.total_usd,
          cost_confirmed_at: new Date().toISOString(),
          pricing_version: expected.pricing_version,
        })
        .eq("id", row_id);
    }

    // Mark clips stage running.
    const STEPS = [
      { key: "script", label: "Picking plant + writing script", status: "done" as const, detail: row.progress?.steps?.find((s: { key: string; detail?: string }) => s.key === "script")?.detail },
      { key: "stills", label: "Preparing 6 hero stills", status: "done" as const, detail: "6 / 6" },
      { key: "clips", label: "Animating 6 clips (Kling v2.1, 10s each)", status: "running" as const, detail: "0 / 6", started_at: new Date().toISOString() },
      { key: "stitch", label: "Stitching final 60s video", status: "pending" as const },
      { key: "save", label: "Saving to library", status: "pending" as const },
    ];
    await supabase
      .from("botanical_animated")
      .update({ queue_status: "animating", clip_urls: new Array(ANIMATION_CLIP_COUNT).fill(""), progress: { stage: "clips", steps: STEPS } })
      .eq("id", row_id);

    // -------- Background: idempotent per-clip jobs --------
    const bg = async () => {
      const GW = "https://connector-gateway.lovable.dev/replicate/v1";
      const clipUrls: string[] = new Array(ANIMATION_CLIP_COUNT).fill("");
      let doneCount = 0;

      const animateOne = async (idx: number) => {
        if (await isStopped(supabase, row_id)) throw new Error("stopped");
        const moment = ORDER[idx];
        const stillUrl = stills[idx];
        const prompt = MOTION_BY_MOMENT[moment];
        const jobKey = `clip:${idx}`;

        const claim = await claimJob(supabase, row_id, jobKey, "replicate", KLING_MODEL);
        const job = claim.job;

        // If a prior succeeded attempt already produced output_url, reuse it.
        if (job.status === "succeeded" && job.output_url) {
          clipUrls[idx] = job.output_url;
          doneCount++;
          return;
        }

        let predId = job.prediction_id ?? null;

        // Submit only if we claimed (fresh) and don't already have a prediction id.
        if (claim.claimed || !predId) {
          if (await isStopped(supabase, row_id)) throw new Error("stopped");
          await updateJob(supabase, job.id, { status: "submitting" });
          const klingInput = {
            start_image: stillUrl,
            prompt,
            negative_prompt: NEGATIVE_PROMPT,
            duration: ANIMATION_CLIP_SECONDS,
            aspect_ratio: "9:16",
            cfg_scale: 0.5,
            mode: ANIMATION_MODE,
          };
          const createRes = await fetch(`${GW}/models/${KLING_MODEL}/predictions`, {
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
            await updateJob(supabase, job.id, { status: "failed", error: `create ${createRes.status}: ${txt.slice(0, 200)}` });
            throw new Error(`Kling create failed ${createRes.status}: ${txt.slice(0, 200)}`);
          }
          const pred = await createRes.json();
          predId = pred.id;
          await updateJob(supabase, job.id, { status: "running", prediction_id: predId });
        } else {
          await updateJob(supabase, job.id, { status: "running" });
        }

        // Poll up to 8 min, checking stop each iteration.
        let outputUrl: string | null = null;
        for (let i = 0; i < 160; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          if (await isStopped(supabase, row_id)) {
            await updateJob(supabase, job.id, { status: "canceled", error: "stopped mid-poll" });
            throw new Error("stopped");
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
            throw new Error(`Kling ${p.status}: ${p.error ?? ""}`);
          }
        }
        if (!outputUrl) {
          await updateJob(supabase, job.id, { status: "expired", error: "poll timeout" });
          throw new Error("Kling timed out");
        }

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
        await updateJob(supabase, job.id, { status: "succeeded", output_url: pub.publicUrl });

        if (await isStopped(supabase, row_id)) return; // don't advance a canceled run
        await supabase
          .from("botanical_animated")
          .update({
            clip_urls: clipUrls,
            progress: {
              stage: "clips",
              steps: STEPS.map((s) =>
                s.key === "clips"
                  ? { ...s, status: doneCount === ANIMATION_CLIP_COUNT ? "done" : "running", detail: `${doneCount} / ${ANIMATION_CLIP_COUNT}` }
                  : s,
              ),
            },
          })
          .eq("id", row_id);
      };

      try {
        const queue = [0, 1, 2, 3, 4, 5];
        const runners = [0, 1].map(async () => {
          while (queue.length > 0) {
            if (await isStopped(supabase, row_id)) return;
            const idx = queue.shift();
            if (idx === undefined) break;
            await animateOne(idx);
          }
        });
        await Promise.all(runners);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg === "stopped") return; // stop path already recorded
        console.error("animate bg error:", msg);
        await supabase
          .from("botanical_animated")
          .update({ queue_status: "error", error: msg })
          .eq("id", row_id);
        return;
      }

      if (await isStopped(supabase, row_id)) return;
      await mergeCost(supabase, row_id, "clips", clipsCost(ANIMATION_CLIP_COUNT, ANIMATION_CLIP_SECONDS, ANIMATION_MODE));
      await supabase
        .from("botanical_animated")
        .update({
          queue_status: "stitching",
          progress: {
            stage: "stitch",
            steps: STEPS.map((s) => {
              if (s.key === "clips") return { ...s, status: "done" as const, detail: `${ANIMATION_CLIP_COUNT} / ${ANIMATION_CLIP_COUNT}` };
              if (s.key === "stitch") return { ...s, status: "running" as const };
              return s;
            }),
          },
        })
        .eq("id", row_id);

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

    return json({ success: true, pricing_version: PRICING_VERSION }, 202);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ success: false, error: msg }, 500);
  }
});
