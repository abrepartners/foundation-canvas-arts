// Service-role writer for queue moderation actions (approve/reject/reset,
// hook swap, delete). Client is blocked from direct UPDATE/DELETE by RLS.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireAuthorized(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { id, action, status, script, hook_variants } = body ?? {};
    if (!id || typeof id !== "string") {
      return new Response(JSON.stringify({ error: "id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "delete") {
      const { error } = await admin.from("botanical_content").delete().eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const patch: Record<string, unknown> = {};
    if (status !== undefined) {
      if (!["pending", "approved", "rejected"].includes(status)) {
        return new Response(JSON.stringify({ error: "invalid status" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      patch.queue_status = status;
    }
    if (script !== undefined) patch.script = script;
    if (hook_variants !== undefined) patch.hook_variants = hook_variants;

    if (Object.keys(patch).length === 0) {
      return new Response(JSON.stringify({ error: "no fields to update" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error } = await admin.from("botanical_content").update(patch).eq("id", id);
    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("queue-moderation error", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
