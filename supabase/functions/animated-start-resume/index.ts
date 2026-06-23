import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const INITIAL_STEPS = [
  { key: "script", label: "Picking plant + writing script", status: "pending" },
  { key: "stills", label: "Designing 6 hero stills (OpenAI gpt-image-2)", status: "pending" },
  { key: "clips", label: "Animating 6 clips (Kling v2.1, 10s each)", status: "pending" },
  { key: "stitch", label: "Stitching final 60s video", status: "pending" },
  { key: "save", label: "Saving to library", status: "pending" },
] as const;

const ORDER = ["hook", "dangle_1", "rehook", "dangle_2", "verified_truth", "close"];
const POLL_ITERATIONS = 30; // 30 * 3s = 90s per invocation
const POLL_INTERVAL_MS = 3000;
const STALE_GENERATING_MS = 60_000;

interface Visual {
  moment: string;
  prompt?: string;
  image_url?: string | null;
  status?: string;
  started_at?: string | null;
  error?: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE);

    const body = await req.json().catch(() => ({}));
    const rowId: string | undefined = body?.row_id;
    if (!rowId) {
      return new Response(JSON.stringify({ success: false, error: "row_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: animatedRow, error: rErr } = await supabase
      .from("botanical_animated")
      .select("source_content_id, plant_name")
      .eq("id", rowId)
      .single();
    if (rErr || !animatedRow?.source_content_id) {
      throw new Error(rErr?.message ?? "row missing source_content_id");
    }
    const sourceId = animatedRow.source_content_id as string;
    const plantName = animatedRow.plant_name as string | null;

    const bg = async () => {
      try {
        let lastResumeAt = 0;

        for (let i = 0; i < POLL_ITERATIONS; i++) {
          await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
          const { data: src } = await supabase
            .from("botanical_content")
            .select("script_visuals")
            .eq("id", sourceId)
            .single();
          if (!src?.script_visuals) continue;

          let visuals: Visual[] = [];
          try {
            visuals = typeof src.script_visuals === "string"
              ? JSON.parse(src.script_visuals as string)
              : (src.script_visuals as Visual[]);
          } catch { continue; }

          const ordered = ORDER.map((m) => visuals.find((v) => v.moment === m)).filter(Boolean) as Visual[];
          const doneCount = ordered.filter((v) => v.image_url && v.status === "done").length;
          const stillUrls = ordered.map((v) => v.image_url || "");

          await supabase
            .from("botanical_animated")
            .update({
              still_urls: stillUrls,
              progress: {
                stage: "stills",
                steps: INITIAL_STEPS.map((s) => {
                  if (s.key === "script") return { ...s, status: "done", detail: plantName ?? "" };
                  if (s.key === "stills") return { ...s, status: doneCount === 6 ? "done" : "running", detail: `${doneCount} / 6` };
                  return s;
                }),
              },
            })
            .eq("id", rowId);

          if (doneCount === 6 && ordered.every((v) => v.image_url)) {
            await supabase
              .from("botanical_animated")
              .update({
                queue_status: "stills_ready",
                progress: {
                  stage: "clips_ready",
                  steps: INITIAL_STEPS.map((s) => {
                    if (s.key === "script") return { ...s, status: "done", detail: plantName ?? "" };
                    if (s.key === "stills") return { ...s, status: "done", detail: "6 / 6" };
                    return s;
                  }),
                },
              })
              .eq("id", rowId);
            return;
          }

          // If any visual is stuck (errored or generating > 60s), kick resume — rate-limit to once per 30s.
          const now = Date.now();
          const hasStuck = ordered.some((v) => {
            if (v.status === "done" && v.image_url) return false;
            if (v.status === "error") return true;
            if (v.status === "generating") {
              const t = v.started_at ? Date.parse(v.started_at) : 0;
              return !t || now - t > STALE_GENERATING_MS;
            }
            return !v.image_url;
          });
          if (hasStuck && now - lastResumeAt > 30_000) {
            lastResumeAt = now;
            // Fire-and-forget
            supabase.functions.invoke("generate-botanical-resume", {
              body: { content_id: sourceId, image_provider: "openai" },
            }).catch((e) => console.warn("resume invoke failed:", e));
          }
        }

        // Not done in this window — self-chain.
        console.log(`animated-start-resume: not done after ${POLL_ITERATIONS} iterations; re-chaining`);
        await supabase.functions.invoke("animated-start-resume", { body: { row_id: rowId } });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("animated-start-resume bg error:", msg);
        await supabase
          .from("botanical_animated")
          .update({ queue_status: "error", error: msg })
          .eq("id", rowId);
      }
    };

    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(bg());
    } else { bg(); }

    return new Response(JSON.stringify({ success: true }), {
      status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
