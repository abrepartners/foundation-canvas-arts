// YouTube OAuth callback. Authenticated initiation happens through
// platform-insights and uses a one-time state stored server-side.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appOrigin = Deno.env.get("APP_ORIGIN");
    if (!clientId || !clientSecret || !supabaseUrl || !serviceKey) return html("YouTube connection is not configured.", 500);
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state) return html("Missing OAuth callback parameters.", 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const stateHash = await sha256(state);
    const { data: stateRow } = await admin.from("platform_oauth_states").select("*")
      .eq("state_hash", stateHash).eq("platform", "youtube").is("used_at", null).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (!stateRow) return html("This YouTube connection link is invalid or expired.", 400);
    await admin.from("platform_oauth_states").update({ used_at: new Date().toISOString() }).eq("state_hash", stateHash);

    const redirectUri = `${supabaseUrl}/functions/v1/youtube-oauth`;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }),
    });
    const token = await tokenResponse.json();
    if (!tokenResponse.ok || !token.access_token) return html("YouTube token exchange failed.", 502);

    const channelResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const channelPayload = await channelResponse.json();
    const channel = channelPayload?.items?.[0];
    if (!channelResponse.ok || !channel?.id) return html("Connected Google account does not expose a YouTube channel.", 400);

    const scopes = String(token.scope ?? "").split(" ").filter(Boolean);
    const { data: current } = await admin.from("platform_connections").select("refresh_token")
      .eq("platform", "youtube").eq("account_id", channel.id).maybeSingle();
    const { error } = await admin.from("platform_connections").upsert({
      platform: "youtube",
      account_id: channel.id,
      account_name: channel.snippet?.title ?? null,
      access_token: token.access_token,
      refresh_token: token.refresh_token ?? current?.refresh_token ?? null,
      expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      scopes,
      metadata: { thumbnail: channel.snippet?.thumbnails?.default?.url ?? null },
      updated_at: new Date().toISOString(),
    }, { onConflict: "platform,account_id" });
    if (error) return html("YouTube connected, but the secure token store failed.", 500);
    if (appOrigin) return Response.redirect(`${appOrigin}/insights?connected=youtube`, 302);
    return html("YouTube connected. You can close this tab.");
  } catch (error) {
    console.error("youtube-oauth", error);
    return html("YouTube connection failed.", 500);
  }
});
