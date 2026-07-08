// Polls TikTok publish status for a given publish_id and returns a normalized
// status so the client can show progress until the carousel is in the user's
// drafts/inbox (SEND_TO_USER_INBOX) or has failed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";

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
      throw new Error(
        "TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET not configured",
      );
    }
    if (!SUPABASE_URL || !SERVICE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    let body: { publish_id?: unknown } = {};
    try {
      body = await req.json();
    } catch {
      /* empty */
    }
    const publishId =
      typeof body.publish_id === "string" ? body.publish_id.trim() : "";
    if (!publishId || publishId.length > 200) {
      return json({ error: "publish_id is required" }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: tokenRow, error: tokenError } = await supabase
      .from("tiktok_tokens")
      .select("id, open_id, access_token, refresh_token, expires_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<TokenRow>();
    if (tokenError)
      throw new Error(`Token lookup failed: ${tokenError.message}`);
    if (!tokenRow) {
      return json({ error: "TikTok not connected" }, 400);
    }

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
      body: JSON.stringify({ publish_id: publishId }),
    });
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    const data =
      (parsed as { data?: { status?: string; fail_reason?: string } })?.data ??
      {};
    const errCode = (parsed as { error?: { code?: string; message?: string } })
      ?.error?.code;
    if (!res.ok || (errCode && errCode !== "ok")) {
      return json(
        {
          status: "FAILED",
          fail_reason:
            (parsed as { error?: { message?: string } })?.error?.message ??
            "TikTok status request failed",
          raw: parsed,
        },
        200,
      );
    }

    return json({
      status: data.status ?? "UNKNOWN",
      fail_reason: data.fail_reason ?? null,
      raw: parsed,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("tiktok-publish-status error:", msg);
    return json({ error: msg }, 500);
  }
});
