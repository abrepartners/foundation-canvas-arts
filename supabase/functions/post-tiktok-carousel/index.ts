// Sends a photo carousel to the connected TikTok account's inbox as a DRAFT
// (post_mode MEDIA_UPLOAD). The user finishes and publishes inside TikTok.
// Uses the app's own TikTok developer app via tokens stored by tiktok-oauth.
// Requires secrets: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET.
// Note: TikTok photo posts only support PULL_FROM_URL, and the image URL
// prefix must be verified in the TikTok developer portal (URL properties).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decode as decodeImage } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const BUCKET = "botanical-faceless-visuals";

// TikTok PHOTO carousel image constraints (empirically tightest set that avoids
// picture_size_check_failed): short side >= 360px, long side <= 1920px, file
// size <= 20MB, JPEG only. We normalize EVERY image to be safe.
const MAX_LONG_SIDE = 1920;
const TARGET_WIDTH = 1080; // standard portrait width
const JPEG_QUALITY = 85;

async function normalizeToTikTokJpeg(
  url: string,
  supabase: ReturnType<typeof createClient>,
  publicBase: string,
): Promise<string> {
  // Fast path: if the URL already points at a normalized JPEG we produced
  // previously, reuse it without any decode/encode work.
  if (url.includes("/tiktok-jpeg/") && /\.jpe?g(\?|$)/i.test(url)) {
    return url;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());

  // deno-lint-ignore no-explicit-any
  const img: any = await decodeImage(bytes);
  if (!img || typeof img.width !== "number") {
    throw new Error("Could not decode image");
  }

  let w: number = img.width;
  let h: number = img.height;
  const longSide = Math.max(w, h);

  // Resize if too large. Portrait 9:16 → width becomes TARGET_WIDTH.
  if (longSide > MAX_LONG_SIDE || (h >= w && w > TARGET_WIDTH)) {
    const scale = h >= w
      ? TARGET_WIDTH / w
      : MAX_LONG_SIDE / longSide;
    w = Math.round(w * scale);
    h = Math.round(h * scale);
    img.resize(w, h);
  }

  const jpegBytes: Uint8Array = await img.encodeJPEG(JPEG_QUALITY);

  if (jpegBytes.byteLength > 19 * 1024 * 1024) {
    throw new Error(`Image too large after compression: ${jpegBytes.byteLength} bytes`);
  }

  // Derive a stable path inside the bucket — same input always maps to same
  // output, so the upsert short-circuits on subsequent posts of the same set.
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  const originalPath = idx >= 0
    ? url.slice(idx + marker.length).split("?")[0]
    : `misc/${crypto.randomUUID()}.jpg`;
  const jpegPath = `tiktok-jpeg/${originalPath.replace(/\.(png|webp|jpe?g)$/i, "")}-${w}x${h}-q${JPEG_QUALITY}.jpg`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(jpegPath, jpegBytes, {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (upErr) throw new Error(`Upload failed for ${jpegPath}: ${upErr.message}`);

  return `${publicBase}/${jpegPath}`;
}

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

    // ----- Parse + validate request BEFORE doing any heavy work -----
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

    // ----- Heavy work runs in the background so we never hit the 2s CPU cap -----
    const bg = async () => {
      try {
        // Most recently connected account
        const { data: tokenRow, error: tokenError } = await supabase
          .from("tiktok_tokens")
          .select("id, open_id, access_token, refresh_token, expires_at")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle<TokenRow>();
        if (tokenError) throw new Error(`Token lookup failed: ${tokenError.message}`);
        if (!tokenRow) throw new Error("TikTok not connected");

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
            throw new Error(`TikTok token refresh failed: ${JSON.stringify(refreshed)}`);
          }
          accessToken = refreshed.access_token;
          await supabase
            .from("tiktok_tokens")
            .update({
              access_token: refreshed.access_token,
              refresh_token: refreshed.refresh_token ?? tokenRow.refresh_token,
              expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", tokenRow.id);
        }

        // Normalize every image (sequential to stay under per-tick CPU budget).
        const publicBase = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}`;
        const jpegImages: string[] = [];
        for (const u of images) {
          jpegImages.push(await normalizeToTikTokJpeg(u, supabase, publicBase));
        }

        const payload = {
          post_info: { title, description },
          source_info: {
            source: "PULL_FROM_URL",
            photo_cover_index: 0,
            photo_images: jpegImages,
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
        if (!tiktokRes.ok) {
          console.error("TikTok rejected:", tiktokRes.status, text);
        } else {
          console.log("TikTok accepted:", text);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("post-tiktok-carousel bg error:", msg);
      }
    };

    // @ts-ignore - EdgeRuntime is provided by the Supabase edge runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(bg());
    } else {
      bg();
    }

    return json({ ok: true, queued: true }, 202);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("post-tiktok-carousel error:", msg);
    return json({ error: msg }, 500);
  }
});
