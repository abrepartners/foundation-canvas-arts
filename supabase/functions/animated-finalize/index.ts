import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";
import { guardedUpdateAnimated } from "../_shared/guardedUpdate.ts";

// Accepts the client-stitched final MP4 as raw bytes (Content-Type: video/mp4)
// with row_id in the query string. Uploads to storage and marks the row done.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeadersFor(req) });

    const corsHeaders = corsHeadersFor(req);
    const __auth = await requireAuthorized(req);
    if (!__auth.ok) return __auth.response;

  try {
    const url = new URL(req.url);
    const rowId = url.searchParams.get("row_id");
    if (!rowId) throw new Error("Missing row_id query param");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: current } = await supabase
      .from("botanical_animated")
      .select("queue_status, stop_requested_at")
      .eq("id", rowId)
      .maybeSingle();
    if (!current) throw new Error("Animation row not found");
    if (current.stop_requested_at || ["canceled", "error", "done"].includes(current.queue_status)) {
      throw new Error(`Animation row is ${current.queue_status}`);
    }

    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.byteLength === 0) throw new Error("Empty body");

    const path = `animated/${rowId}/final.mp4`;
    const { error: upErr } = await supabase.storage
      .from("botanical-faceless-visuals")
      .upload(path, bytes, { contentType: "video/mp4", upsert: true });
    if (upErr) throw new Error(`Upload: ${upErr.message}`);

    const { data: pub } = supabase.storage.from("botanical-faceless-visuals").getPublicUrl(path);

    const { data: row } = await supabase
      .from("botanical_animated")
      .select("progress")
      .eq("id", rowId)
      .single();
    const prevSteps = (row?.progress as { steps?: Array<Record<string, unknown>> })?.steps ?? [];
    const nextSteps = prevSteps.map((s) => {
      if (s.key === "stitch") return { ...s, status: "done", ended_at: new Date().toISOString() };
      if (s.key === "save") return { ...s, status: "done", ended_at: new Date().toISOString() };
      return s;
    });

    const applied = await guardedUpdateAnimated(supabase, rowId, {
      final_video_url: pub.publicUrl,
      queue_status: "done",
      progress: { stage: "done", steps: nextSteps },
    });
    if (!applied) throw new Error("Animation was stopped before finalization completed");

    return new Response(JSON.stringify({ success: true, final_video_url: pub.publicUrl }), {
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
