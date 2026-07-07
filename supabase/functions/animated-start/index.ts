import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Step {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
  started_at?: string;
  ended_at?: string;
}

const INITIAL_STEPS: Step[] = [
  { key: "script", label: "Picking plant + writing script", status: "pending" },
  { key: "stills", label: "Designing 6 hero stills (OpenAI gpt-image-2)", status: "pending" },
  { key: "clips", label: "Animating 6 clips (Kling v2.1, 10s each)", status: "pending" },
  { key: "stitch", label: "Stitching final 60s video", status: "pending" },
  { key: "save", label: "Saving to library", status: "pending" },
];

const MOMENT_ORDER = ["hook", "dangle_1", "rehook", "dangle_2", "verified_truth", "close"] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let providedSourceId: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.source_content_id === "string") {
        providedSourceId = body.source_content_id;
      }
    } catch {
      // no body / not JSON — treat as fresh-generation flow
    }

    // 1. Insert the animated row immediately so the UI gets an id to subscribe to.
    const { data: row, error: insertError } = await supabase
      .from("botanical_animated")
      .insert({
        queue_status: "generating",
        progress: {
          stage: providedSourceId ? "stills" : "script",
          steps: INITIAL_STEPS.map((s, i) =>
            i === 0 ? { ...s, status: "running", started_at: new Date().toISOString() } : s,
          ),
        },
      })
      .select("id")
      .single();

    if (insertError || !row?.id) throw new Error(insertError?.message ?? "Insert failed");
    const rowId = row.id;

    // 2. Background: either reuse an existing botanical_content row, or generate a fresh one.
    const bg = async () => {
      try {
        let sourceId: string;
        let content: {
          plant_name: string;
          verified_fact: string;
          script: unknown;
          caption: string;
        };
        let reusedStills: string[] | null = null;

        if (providedSourceId) {
          const { data: src, error: srcErr } = await supabase
            .from("botanical_content")
            .select("id, plant_name, verified_fact, script, caption, script_visuals")
            .eq("id", providedSourceId)
            .single();
          if (srcErr || !src) throw new Error(srcErr?.message ?? "Source content not found");

          let visuals: Array<{ moment: string; image_url?: string | null; status?: string }> = [];
          try {
            visuals = typeof src.script_visuals === "string"
              ? JSON.parse(src.script_visuals)
              : (src.script_visuals as typeof visuals);
          } catch {
            visuals = [];
          }

          const stills = MOMENT_ORDER.map((m) => {
            const v = visuals.find((x) => x.moment === m);
            return v?.image_url ?? "";
          });
          if (stills.some((u) => !u)) {
            throw new Error("Selected content is missing one or more stills");
          }

          sourceId = src.id;
          content = {
            plant_name: src.plant_name ?? "",
            verified_fact: src.verified_fact ?? "",
            script: typeof src.script === "string" ? (() => { try { return JSON.parse(src.script as string); } catch { return src.script; } })() : src.script,
            caption: src.caption ?? "",
          };
          reusedStills = stills;
        } else {
          const { data: gen, error: genError } = await supabase.functions.invoke(
            "generate-botanical-content",
            { body: { image_provider: "openai" } },
          );
          if (genError) throw new Error(genError.message);
          if (!gen?.success) throw new Error(gen?.error ?? "generate-botanical-content failed");
          sourceId = gen.content_id as string;
          content = gen.content;
        }

        const now = new Date().toISOString();
        const updatePayload: Record<string, unknown> = {
          source_content_id: sourceId,
          plant_name: content.plant_name,
          verified_fact: content.verified_fact,
          script: content.script,
          caption: content.caption,
          progress: {
            stage: reusedStills ? "clips" : "stills",
            steps: INITIAL_STEPS.map((s) => {
              if (s.key === "script") {
                return { ...s, status: "done", ended_at: now, detail: content.plant_name };
              }
              if (s.key === "stills") {
                return reusedStills
                  ? { ...s, status: "done", started_at: now, ended_at: now, detail: "6 / 6 (reused)" }
                  : { ...s, status: "running", started_at: now, detail: "0 / 6" };
              }
              return s;
            }),
          },
        };
        if (reusedStills) {
          updatePayload.still_urls = reusedStills;
          updatePayload.queue_status = "stills_ready";
        }

        await supabase.from("botanical_animated").update(updatePayload).eq("id", rowId);

        // If we generated fresh stills, hand off polling. If we reused, the client's
        // stills_ready effect will trigger animated-animate-all directly.
        if (!reusedStills) {
          await supabase.functions.invoke("animated-start-resume", { body: { row_id: rowId } });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("animated-start bg error:", msg);
        await supabase
          .from("botanical_animated")
          .update({ queue_status: "error", error: msg })
          .eq("id", rowId);
      }
    };

    // @ts-ignore - EdgeRuntime is available
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(bg());
    } else {
      bg();
    }

    return new Response(JSON.stringify({ success: true, row_id: rowId }), {
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
