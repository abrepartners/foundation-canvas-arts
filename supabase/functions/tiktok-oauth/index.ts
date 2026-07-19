// TikTok OAuth callback. Authenticated initiation happens through
// platform-insights, which stores a one-time state row before returning the
// TikTok consent URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function html(message: string, status = 200): Response {
  return new Response(`<!doctype html><html><body style="font-family:system-ui;padding:2rem;background:#111;color:#eee"><h2>${message}</h2></body></html>`, {
    status, headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  try {
    const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
    const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appOrigin = Deno.env.get("APP_ORIGIN");
    if (!clientKey || !clientSecret || !supabaseUrl || !serviceKey) return html("TikTok connection is not configured.", 500);

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const returnedError = url.searchParams.get("error");
    if (returnedError) return html(`TikTok authorization was canceled: ${returnedError}`, 400);
    if (!code || !state) return html("Missing OAuth callback parameters.", 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const stateHash = await sha256(state);
    const { data: stateRow } = await admin.from("platform_oauth_states").select("*")
      .eq("state_hash", stateHash).eq("platform", "tiktok").is("used_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!stateRow) return html("This TikTok connection link is invalid or expired.", 400);
    await admin.from("platform_oauth_states").update({ used_at: new Date().toISOString() }).eq("state_hash", stateHash);

    const redirectUri = `${supabaseUrl}/functions/v1/tiktok-oauth`;
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }),
    });
    const token = await response.json();
    if (!response.ok || !token.access_token || !token.open_id) return html("TikTok token exchange failed.", 502);

    const now = Date.now();
    const { error } = await admin.from("tiktok_tokens").upsert({
      open_id: token.open_id,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: new Date(now + token.expires_in * 1000).toISOString(),
      refresh_expires_at: token.refresh_expires_in ? new Date(now + token.refresh_expires_in * 1000).toISOString() : null,
      scope: token.scope ?? null,
      updated_at: new Date(now).toISOString(),
    }, { onConflict: "open_id" });
    if (error) return html("TikTok connected, but the secure token store failed.", 500);
    if (appOrigin) return Response.redirect(`${appOrigin}/insights?connected=tiktok`, 302);
    return html("TikTok connected. You can close this tab.");
  } catch (error) {
    console.error("tiktok-oauth", error);
    return html("TikTok connection failed.", 500);
  }
});
