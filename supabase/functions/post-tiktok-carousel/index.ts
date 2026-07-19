// Sends a photo carousel to the connected TikTok account's inbox as a DRAFT
// (post_mode MEDIA_UPLOAD). The user finishes and publishes inside TikTok.
// Uses the app's own TikTok developer app via tokens stored by tiktok-oauth.
// Requires secrets: TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET.
// Note: TikTok photo posts only support PULL_FROM_URL, and the image URL
// prefix must be verified in the TikTok developer portal (URL properties).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";

const BUCKET = "botanical-faceless-visuals";

// TikTok PHOTO carousel image constraints (empirically tightest set that avoids
// picture_size_check_failed): short side >= 360px, long side <= 1920px, file
// size <= 20MB, JPEG only. We normalize EVERY image via Supabase Storage's
// image transformation endpoint (server-side resize) — no in-process decode.
const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1920;
const JPEG_QUALITY = 85;

async function normalizeToTikTokJpeg(
  url: string,
  supabase: ReturnType<typeof createClient>,
  publicBase: string,
  renderBase: string,
): Promise<string> {
  // Fast path: previously normalized JPEG — reuse as-is.
  if (url.includes("/tiktok-jpeg/") && /\.jpe?g(\?|$)/i.test(url)) {
    return url;
  }

  // Derive the bucket-relative path from the public URL.
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) {
    throw new Error(`Unsupported image URL (not in ${BUCKET}): ${url}`);
  }
  const originalPath = url.slice(idx + marker.length).split("?")[0];
  const jpegPath = `tiktok-jpeg/${originalPath.replace(/\.(png|webp|jpe?g)$/i, "")}-${TARGET_WIDTH}x${TARGET_HEIGHT}-q${JPEG_QUALITY}.jpg`;
  const finalUrl = `${publicBase}/${jpegPath}`;

  // If the cached JPEG already exists, skip re-uploading.
  const headRes = await fetch(finalUrl, { method: "HEAD" });
  if (headRes.ok) return finalUrl;

  // Ask Supabase Storage to resize server-side. `resize=contain` preserves
  // aspect ratio and keeps the long side within TARGET_HEIGHT (1920).
  const transformUrl =
    `${renderBase}/${originalPath}` +
    `?width=${TARGET_WIDTH}&height=${TARGET_HEIGHT}&resize=contain&quality=${JPEG_QUALITY}&format=origin`;

  const res = await fetch(transformUrl, { headers: { Accept: "image/jpeg" } });
  if (!res.ok) {
    throw new Error(`Storage transform failed for ${originalPath}: ${res.status} ${await res.text()}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());

  if (bytes.byteLength > 19 * 1024 * 1024) {
    throw new Error(`Image too large after transform: ${bytes.byteLength} bytes`);
  }

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(jpegPath, bytes, {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (upErr) throw new Error(`Upload failed for ${jpegPath}: ${upErr.message}`);

  return finalUrl;
}

const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const CONTENT_INIT_URL =
  "https://open.tiktokapis.com/v2/post/publish/content/init/";

interface Body {
  title?: string;
  description?: string;
  photo_images: string[];
  content_id?: string;
  idempotency_key?: string;
}

interface TokenRow {
  id: string;
  open_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersFor(req) });

  const corsHeaders = corsHeadersFor(req);
  const json = (payload: unknown, status = 200): Response =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const __auth = await requireAuthorized(req);
  if (!__auth.ok) return __auth.response;

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
    const contentId = typeof body.content_id === "string" ? body.content_id : null;
    const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key : null;
    if (!contentId || !idempotencyKey) {
      return json({ error: "content_id and idempotency_key are required" }, 400);
    }

    const { data: existingPublication } = await supabase
      .from("content_publications")
      .select("id, status")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existingPublication) {
      const { data: existingJob } = await supabase
        .from("tiktok_send_jobs")
        .select("id")
        .eq("publication_id", existingPublication.id)
        .maybeSingle();
      return json({
        ok: true,
        duplicate: true,
        publication_id: existingPublication.id,
        job_id: existingJob?.id ?? null,
      }, 200);
    }

    const { data: publication, error: publicationError } = await supabase
      .from("content_publications")
      .insert({
        botanical_content_id: contentId,
        platform: "tiktok",
        delivery_mode: "draft",
        status: "queued",
        idempotency_key: idempotencyKey,
        title,
        caption: description,
      })
      .select("id")
      .single();
    if (publicationError || !publication) {
      if (publicationError?.code === "23505") {
        const { data: raced } = await supabase
          .from("content_publications")
          .select("id")
          .eq("idempotency_key", idempotencyKey)
          .single();
        const { data: racedJob } = raced ? await supabase
          .from("tiktok_send_jobs")
          .select("id")
          .eq("publication_id", raced.id)
          .maybeSingle() : { data: null };
        return json({ ok: true, duplicate: true, publication_id: raced?.id, job_id: racedJob?.id ?? null });
      }
      throw new Error(`Failed to create publication: ${publicationError?.message ?? "unknown"}`);
    }

    // ----- Create a job row so the client can observe real progress -----
    const { data: jobRow, error: jobErr } = await supabase
      .from("tiktok_send_jobs")
      .insert({ phase: "queued", content_id: contentId, publication_id: publication.id })
      .select("id")
      .single();
    if (jobErr || !jobRow) {
      throw new Error(`Failed to create send job: ${jobErr?.message ?? "unknown"}`);
    }
    const jobId = jobRow.id as string;

    const updateJob = async (patch: Record<string, unknown>) => {
      await supabase
        .from("tiktok_send_jobs")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", jobId);
    };
    const updatePublication = async (patch: Record<string, unknown>) => {
      await supabase
        .from("content_publications")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", publication.id);
    };

    // ----- Heavy work runs in the background so we never hit the 2s CPU cap -----
    const bg = async () => {
      try {
        await updateJob({ phase: "normalizing" });
        await updatePublication({ status: "uploading" });

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
        const renderBase = `${SUPABASE_URL}/storage/v1/render/image/public/${BUCKET}`;
        const jpegImages: string[] = [];
        for (const u of images) {
          jpegImages.push(await normalizeToTikTokJpeg(u, supabase, publicBase, renderBase));
        }

        await updateJob({ phase: "initializing" });

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
        let parsed: unknown;
        try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }

        const publishId =
          (parsed as { data?: { publish_id?: string } })?.data?.publish_id ?? null;
        const errObj = (parsed as { error?: { code?: string; message?: string } })?.error;
        const errCode = errObj?.code;

        if (!tiktokRes.ok || (errCode && errCode !== "ok") || !publishId) {
          const failReason =
            errObj?.message ??
            `TikTok init failed (HTTP ${tiktokRes.status})`;
          console.error("TikTok rejected:", tiktokRes.status, text);
          await updateJob({
            phase: "failed",
            fail_reason: failReason,
            raw: parsed,
          });
          await updatePublication({ status: "failed", error: failReason });
          return;
        }

        console.log("TikTok accepted:", text);
        await updateJob({
          phase: "publish_id_received",
          publish_id: publishId,
          raw: parsed,
        });
        await updatePublication({ remote_publish_id: publishId });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("post-tiktok-carousel bg error:", msg);
        await updateJob({ phase: "failed", fail_reason: msg }).catch(() => {});
        await updatePublication({ status: "failed", error: msg }).catch(() => {});
      }
    };

    // @ts-expect-error EdgeRuntime is provided by the Supabase edge runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-expect-error EdgeRuntime is provided by the Supabase edge runtime
      EdgeRuntime.waitUntil(bg());
    } else {
      bg();
    }

    return json({ ok: true, job_id: jobId, publication_id: publication.id }, 202);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("post-tiktok-carousel error:", msg);
    return json({ error: msg }, 500);
  }
});
