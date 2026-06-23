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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1. Insert the animated row immediately so the UI gets an id to subscribe to.
    const { data: row, error: insertError } = await supabase
      .from("botanical_animated")
      .insert({
        queue_status: "generating",
        progress: {
          stage: "script",
          steps: INITIAL_STEPS.map((s, i) =>
            i === 0 ? { ...s, status: "running", started_at: new Date().toISOString() } : s,
          ),
        },
      })
      .select("id")
      .single();

    if (insertError || !row?.id) throw new Error(insertError?.message ?? "Insert failed");
    const rowId = row.id;

    // 2. Background: kick off generate-botanical-content, then hand polling off to animated-start-resume.
    const bg = async () => {
      try {
        const { data: gen, error: genError } = await supabase.functions.invoke(
          "generate-botanical-content",
          { body: { image_provider: "openai" } },
        );
        if (genError) throw new Error(genError.message);
        if (!gen?.success) throw new Error(gen?.error ?? "generate-botanical-content failed");

        const sourceId = gen.content_id as string;
        const content = gen.content;

        await supabase
          .from("botanical_animated")
          .update({
            source_content_id: sourceId,
            plant_name: content.plant_name,
            verified_fact: content.verified_fact,
            script: content.script,
            caption: content.caption,
            progress: {
              stage: "stills",
              steps: INITIAL_STEPS.map((s) => {
                if (s.key === "script") return { ...s, status: "done", ended_at: new Date().toISOString(), detail: content.plant_name };
                if (s.key === "stills") return { ...s, status: "running", started_at: new Date().toISOString(), detail: "0 / 6" };
                return s;
              }),
            },
          })
          .eq("id", rowId);

        // Hand off polling to resume function (bounded; self-chains).
        await supabase.functions.invoke("animated-start-resume", { body: { row_id: rowId } });
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
