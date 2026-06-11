// Sends a photo carousel to the connected TikTok account's inbox as a DRAFT
// (post_mode MEDIA_UPLOAD). The user finishes and publishes inside TikTok.
// Uses the app's own TikTok developer app via tokens stored by tiktok-oauth.
// Requires secrets: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET.
// Note: TikTok photo posts only support PULL_FROM_URL, and the image URL
// prefix must be verified in the TikTok developer portal (URL properties).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const CONTENT_INIT_URL =
  "https://open.tiktokapis.com/v2/post/publish/content/init/";

interface Body {
  title?: string;
  description?: string;
  photo_images: string[];
}

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
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Most recently connected account
    const { data: tokenRow, error: tokenError } = await supabase
      .from("tiktok_tokens")
      .select("id, open_id, access_token, refresh_token, expires_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<TokenRow>();
    if (tokenError)
      throw new Error(`Token lookup failed: ${tokenError.message}`);
    if (!tokenRow) {
      return json(
        {
          error:
            "TikTok not connected — open the tiktok-oauth function URL to connect",
        },
        400,
      );
    }

    // Refresh if the access token expires within 2 minutes
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
          {
            error:
              "TikTok token refresh failed — reconnect via the tiktok-oauth function URL",
            details: refreshed,
          },
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

    const body = (await req.json()) as Body;
    const images = Array.isArray(body.photo_images)
      ? body.photo_images.filter(
          (u) => typeof u === "string" && u.startsWith("http"),
        )
      : [];
    if (images.length < 2 || images.length > 35) {
      return json({ error: "photo_images must contain 2-35 public URLs" }, 400);
    }

    const title = (body.title ?? "").toString().slice(0, 90);
    const description = (body.description ?? "").toString().slice(0, 4000);

    const payload = {
      post_info: {
        title,
        description,
      },
      source_info: {
        source: "PULL_FROM_URL",
        photo_cover_index: 0,
        photo_images: images,
      },
      post_mode: "MEDIA_UPLOAD",
      media_type: "PHOTO",
    };

    const tiktokRes = await fetch(CONTENT_INIT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await tiktokRes.text();
    let result: unknown;
    try {
      result = JSON.parse(text);
    } catch {
      result = { raw: text };
    }

    const errCode = (result as { error?: { code?: string } })?.error?.code;
    if (!tiktokRes.ok || (errCode && errCode !== "ok")) {
      console.error("TikTok rejected:", text);
      return json(
        {
          error: "TikTok rejected the request",
          status: tiktokRes.status,
          details: result,
        },
        502,
      );
    }

    return json({ ok: true, tiktok: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("post-tiktok-carousel error:", msg);
    return json({ error: msg }, 500);
  }
});
