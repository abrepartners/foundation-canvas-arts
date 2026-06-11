// TikTok OAuth for the app's posting account (single-account tool).
// GET  <fn-url>            -> redirects to TikTok's consent screen
// GET  <fn-url>?code=...   -> token exchange callback, stores tokens
// Requires secrets: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET.
// The exact function URL must be registered as the Redirect URI in the
// TikTok developer app's Login Kit settings.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const SCOPES = "user.info.basic,video.upload";

async function expectedState(secret: string): Promise<string> {
  const data = new TextEncoder().encode(`tiktok-oauth-state:${secret}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash).slice(0, 16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function html(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html><body style="font-family:system-ui;padding:2rem;background:#111;color:#eee"><h2>${body}</h2></body></html>`,
    { status, headers: { "Content-Type": "text/html" } },
  );
}

Deno.serve(async (req) => {
  try {
    const CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY");
    const CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!CLIENT_KEY || !CLIENT_SECRET) {
      return html(
        "TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET not configured",
        500,
      );
    }
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return html("Supabase credentials not configured", 500);
    }

    const redirectUri = `${SUPABASE_URL}/functions/v1/tiktok-oauth`;
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const errParam = url.searchParams.get("error");

    if (errParam) {
      return html(
        `TikTok returned an error: ${errParam} — ${url.searchParams.get("error_description") ?? ""}`,
        400,
      );
    }

    // No code -> begin the flow
    if (!code) {
      const authorize = new URL(AUTH_URL);
      authorize.searchParams.set("client_key", CLIENT_KEY);
      authorize.searchParams.set("scope", SCOPES);
      authorize.searchParams.set("response_type", "code");
      authorize.searchParams.set("redirect_uri", redirectUri);
      authorize.searchParams.set("state", await expectedState(CLIENT_SECRET));
      return Response.redirect(authorize.toString(), 302);
    }

    // Callback
    if (state !== (await expectedState(CLIENT_SECRET))) {
      return html(
        "State mismatch — start the flow again from the function URL",
        400,
      );
    }

    const tokenRes = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: CLIENT_KEY,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok || !token.access_token) {
      console.error("Token exchange failed:", JSON.stringify(token));
      return html(`Token exchange failed: ${JSON.stringify(token)}`, 502);
    }

    const now = Date.now();
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { error: upsertError } = await supabase.from("tiktok_tokens").upsert(
      {
        open_id: token.open_id,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: new Date(now + token.expires_in * 1000).toISOString(),
        refresh_expires_at: token.refresh_expires_in
          ? new Date(now + token.refresh_expires_in * 1000).toISOString()
          : null,
        scope: token.scope ?? null,
        updated_at: new Date(now).toISOString(),
      },
      { onConflict: "open_id" },
    );
    if (upsertError) {
      console.error("Token store failed:", upsertError);
      return html(
        `Connected to TikTok but failed to store tokens: ${upsertError.message}`,
        500,
      );
    }

    return html(
      `TikTok connected (scopes: ${token.scope ?? "?"}). You can close this tab and use Send to TikTok in the app.`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("tiktok-oauth error:", msg);
    return html(`Error: ${msg}`, 500);
  }
});
