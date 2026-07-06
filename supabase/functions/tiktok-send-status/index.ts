// Returns the current phase of a tiktok_send_jobs row. Once TikTok has issued
// a publish_id, this function actively polls TikTok's publish/status/fetch/ to
// verify whether the carousel actually landed in the user's drafts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const STATUS_URL =
  "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

interface TokenRow {
  id: string;
  open_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

interface JobRow {
  id: string;
  phase: string;
  publish_id: string | null;
  tiktok_status: string | null;
  fail_reason: string | null;
  raw: unknown;
  updated_at: string;
}

const TERMINAL_STATUSES = new Set([
  "SEND_TO_USER_INBOX",
  "PUBLISH_COMPLETE",
  "FAILED",
]);

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY");
    const CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!CLIENT_KEY || !CLIENT_SECRET) {
      throw new Error("TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET not configured");
    }
    if (!SUPABASE_URL || !SERVICE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    let body: { job_id?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      /* empty */
    }
    const jobId = typeof body.job_id === "string" ? body.job_id.trim() : "";
    if (!jobId) return json({ error: "job_id is required" }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: job, error: jobErr } = await supabase
      .from("tiktok_send_jobs")
      .select("id, phase, publish_id, tiktok_status, fail_reason, raw, updated_at")
      .eq("id", jobId)
      .maybeSingle<JobRow>();
    if (jobErr) throw new Error(`Job lookup failed: ${jobErr.message}`);
    if (!job) return json({ error: "job not found" }, 404);

    // Pre-publish phases: nothing to check with TikTok yet.
    if (
      job.phase === "queued" ||
      job.phase === "normalizing" ||
      job.phase === "initializing"
    ) {
      return json({
        phase: job.phase,
        status: null,
        publish_id: null,
        fail_reason: null,
      });
    }

    if (job.phase === "failed") {
      return json({
        phase: "failed",
        status: "FAILED",
        publish_id: job.publish_id,
        fail_reason: job.fail_reason,
        raw: job.raw,
      });
    }

    if (job.phase === "in_drafts") {
      return json({
        phase: "in_drafts",
        status: job.tiktok_status ?? "SEND_TO_USER_INBOX",
        publish_id: job.publish_id,
        fail_reason: null,
        raw: job.raw,
      });
    }

    // publish_id_received — ask TikTok for the current status.
    if (!job.publish_id) {
      return json({ phase: job.phase, status: null, publish_id: null });
    }

    const { data: tokenRow, error: tokenError } = await supabase
      .from("tiktok_tokens")
      .select("id, open_id, access_token, refresh_token, expires_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<TokenRow>();
    if (tokenError) throw new Error(`Token lookup failed: ${tokenError.message}`);
    if (!tokenRow) return json({ error: "TikTok not connected" }, 400);

    let accessToken = tokenRow.access_token;
    if (new Date(tokenRow.expires_at).getTime() < Date.now() + 120_000) {
      const refreshRes = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_key: CLIENT_KEY,
          client_secret: CLIENT_SECRET,
          grant_type: "refresh_token",
          refresh_token: tokenRow.refresh_token,
        }),
      });
      const refreshed = await refreshRes.json();
      if (!refreshRes.ok || !refreshed.access_token) {
        return json(
          { error: "TikTok token refresh failed", details: refreshed },
          401,
        );
      }
      accessToken = refreshed.access_token;
      await supabase
        .from("tiktok_tokens")
        .update({
          access_token: refreshed.access_token,
          refresh_token: refreshed.refresh_token ?? tokenRow.refresh_token,
          expires_at: new Date(
            Date.now() + refreshed.expires_in * 1000,
          ).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", tokenRow.id);
    }

    const res = await fetch(STATUS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ publish_id: job.publish_id }),
    });
    const text = await res.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

    const data =
      (parsed as { data?: { status?: string; fail_reason?: string } })?.data ??
      {};
    const errObj = (parsed as { error?: { code?: string; message?: string } })?.error;

    if (!res.ok || (errObj?.code && errObj.code !== "ok")) {
      const failReason = errObj?.message ?? "TikTok status request failed";
      await supabase
        .from("tiktok_send_jobs")
        .update({
          phase: "failed",
          tiktok_status: "FAILED",
          fail_reason: failReason,
          raw: parsed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
      return json({
        phase: "failed",
        status: "FAILED",
        publish_id: job.publish_id,
        fail_reason: failReason,
        raw: parsed,
      });
    }

    const status = data.status ?? "UNKNOWN";
    const failReason = data.fail_reason ?? null;

    let nextPhase = job.phase;
    if (status === "SEND_TO_USER_INBOX" || status === "PUBLISH_COMPLETE") {
      nextPhase = "in_drafts";
    } else if (status === "FAILED") {
      nextPhase = "failed";
    }

    if (TERMINAL_STATUSES.has(status) || nextPhase !== job.phase || status !== job.tiktok_status) {
      await supabase
        .from("tiktok_send_jobs")
        .update({
          phase: nextPhase,
          tiktok_status: status,
          fail_reason: failReason,
          raw: parsed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }

    return json({
      phase: nextPhase,
      status,
      publish_id: job.publish_id,
      fail_reason: failReason,
      raw: parsed,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("tiktok-send-status error:", msg);
    return json({ error: msg }, 500);
  }
});
