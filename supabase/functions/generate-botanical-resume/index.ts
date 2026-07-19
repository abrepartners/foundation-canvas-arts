import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";
import { isStopped, updateJob } from "../_shared/providerJobs.ts";
import {
  generateTrackedReplicateImage,
  type TrackedImageResult,
} from "../_shared/trackedReplicate.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

const STALE_GENERATING_MS = 60_000;

async function runReplicatePrediction(
  model: string,
  input: Record<string, unknown>,
  lovableApiKey: string,
  replicateApiKey: string,
): Promise<string> {
  const GW = "https://api.replicate.com/v1";
  const headers = {
    Authorization: `Bearer ${replicateApiKey}`,
    "Content-Type": "application/json",
  };
  let createRes: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    createRes = await fetch(`${GW}/models/${model}/predictions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ input }),
    });
    if (createRes.status !== 429) break;
    await new Promise((r) => setTimeout(r, 12_000));
  }
  if (!createRes || !createRes.ok) {
    const txt = createRes ? await createRes.text() : "no response";
    throw new Error(`Replicate create failed: ${createRes?.status} ${txt}`);
  }
  const pred = await createRes.json();
  const predId = pred.id;
  if (!predId) throw new Error("Replicate: no prediction id");

  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, i < 5 ? 2000 : 3000));
    const pollRes = await fetch(`${GW}/predictions/${predId}`, { headers });
    if (!pollRes.ok) continue;
    const p = await pollRes.json();
    if (p.status === "succeeded") {
      const url = Array.isArray(p.output) ? p.output[0] : p.output;
      if (typeof url !== "string") throw new Error("Replicate: invalid output");
      return url;
    }
    if (p.status === "failed" || p.status === "canceled") {
      throw new Error(`Replicate prediction ${p.status}: ${p.error ?? ""}`);
    }
  }
  throw new Error("Replicate timed out (resume)");
}

async function generateImageBytes(
  provider: "openai" | "replicate",
  prompt: string,
  lovableApiKey: string,
  replicateApiKey: string | undefined,
  tracking?: {
    supabase: SupabaseClient;
    animationRowId: string;
    jobKey: string;
  },
): Promise<{ bytes: Uint8Array; jobId?: string }> {
  if (provider === "openai" || provider === "replicate") {
    if (!replicateApiKey) throw new Error("REPLICATE_API_KEY not configured");
    const model = provider === "openai" ? "openai/gpt-image-2" : "black-forest-labs/flux-1.1-pro";
    const input = provider === "openai"
      ? { prompt, quality: "high", aspect_ratio: "9:16", output_format: "jpeg" }
      : { prompt, aspect_ratio: "9:16", output_format: "jpeg", safety_tolerance: 2 };
    if (tracking) {
      const result: TrackedImageResult = await generateTrackedReplicateImage({
        supabase: tracking.supabase,
        rowId: tracking.animationRowId,
        jobKey: tracking.jobKey,
        model,
        input,
        lovableApiKey,
        replicateApiKey,
        pollLimit: 45,
      });
      return result;
    }

    const url = await runReplicatePrediction(model, input, lovableApiKey, replicateApiKey);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const imgRes = await fetch(url, { signal: ctrl.signal });
      if (!imgRes.ok) throw new Error(`Image fetch failed: ${imgRes.status}`);
      return { bytes: new Uint8Array(await imgRes.arrayBuffer()) };
    } finally { clearTimeout(t); }
  }
  throw new Error("Unsupported image provider");
}

interface Visual {
  moment: string;
  prompt: string;
  image_url?: string | null;
  status?: string;
  started_at?: string | null;
  error?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeadersFor(req) });

    const corsHeaders = corsHeadersFor(req);
    const __auth = await requireAuthorized(req);
    if (!__auth.ok) return __auth.response;
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE = "";
    const REPLICATE = Deno.env.get("REPLICATE_API_KEY") ?? undefined;
    const supabase = createClient(SUPABASE_URL, SERVICE);

    const body = await req.json().catch(() => ({}));
    const contentId: string | undefined = body?.content_id;
    const provider: "openai" | "replicate" = body?.image_provider === "openai" ? "openai" : "replicate";
    // Optional: parent animation row id so future provider-job tracking for
    // stills can attribute retries/costs to the correct animation run.
    const animationRowId: string | null = typeof body?.animation_row_id === "string"
      ? body.animation_row_id
      : null;
    if (!contentId) {
      return new Response(JSON.stringify({ success: false, error: "content_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (animationRowId) console.log(`generate-botanical-resume: animation_row_id=${animationRowId}`);

    const { data: row, error: readErr } = await supabase
      .from("botanical_content")
      .select("script_visuals")
      .eq("id", contentId)
      .single();
    if (readErr || !row) throw new Error(readErr?.message ?? "content not found");

    let visuals: Visual[] = [];
    try {
      visuals = typeof row.script_visuals === "string"
        ? JSON.parse(row.script_visuals as string)
        : (row.script_visuals as Visual[]);
    } catch {
      throw new Error("script_visuals parse failed");
    }

    const now = Date.now();
    const stuck = visuals.filter((v) => {
      if (v.status === "done" && v.image_url) return false;
      if (v.status === "error") return true;
      if (v.status === "generating") {
        const t = v.started_at ? Date.parse(v.started_at) : 0;
        return !t || now - t > STALE_GENERATING_MS;
      }
      return !v.image_url; // queued / undefined
    });

    if (stuck.length === 0) {
      return new Response(JSON.stringify({ success: true, resumed: 0 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`resume ${contentId}: retrying ${stuck.length} — ${stuck.map((v) => v.moment).join(", ")}`);

    const mergeVisual = async (moment: string, patch: Partial<Visual>) => {
      const { data: cur } = await supabase
        .from("botanical_content").select("script_visuals").eq("id", contentId).single();
      let arr: Visual[] = visuals;
      if (cur?.script_visuals) {
        try {
          arr = typeof cur.script_visuals === "string"
            ? JSON.parse(cur.script_visuals as string)
            : (cur.script_visuals as Visual[]);
        } catch { /* keep */ }
      }
      const next = arr.map((v) => v.moment === moment ? { ...v, ...patch } : v);
      await supabase.from("botanical_content")
        .update({ script_visuals: JSON.stringify(next) }).eq("id", contentId);
    };

    const bg = async () => {
      for (const v of stuck) {
        if (animationRowId && await isStopped(supabase, animationRowId)) return;
        await mergeVisual(v.moment, {
          status: "generating",
          error: null,
          started_at: new Date().toISOString(),
        });
        try {
          const imageResult = await generateImageBytes(
            provider,
            v.prompt,
            LOVABLE,
            REPLICATE,
            animationRowId
              ? {
                  supabase,
                  animationRowId,
                  jobKey: `still:${v.moment}`,
                }
              : undefined,
          );
          const ext = provider === "lovable" ? "png" : "jpg";
          const path = `${contentId}/${v.moment}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("botanical-faceless-visuals")
            .upload(path, imageResult.bytes, {
              contentType: ext === "jpg" ? "image/jpeg" : "image/png",
              upsert: true,
            });
          if (upErr) throw new Error(`upload: ${upErr.message}`);
          const { data: u } = supabase.storage
            .from("botanical-faceless-visuals").getPublicUrl(path);
          if (imageResult.jobId) {
            await updateJob(supabase, imageResult.jobId, {
              status: "succeeded",
              output_url: u.publicUrl,
              error: null,
            });
          }
          await mergeVisual(v.moment, { image_url: u.publicUrl, status: "done", error: null });
          console.log(`resume: done ${v.moment}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`resume: error ${v.moment}:`, msg);
          await mergeVisual(v.moment, {
            image_url: null, status: "error", error: msg.slice(0, 240),
          });
        }
      }
    };

    // @ts-expect-error EdgeRuntime is provided by the Supabase edge runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-expect-error EdgeRuntime is provided by the Supabase edge runtime
      EdgeRuntime.waitUntil(bg());
    } else {
      bg();
    }

    return new Response(JSON.stringify({ success: true, resumed: stuck.length }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
