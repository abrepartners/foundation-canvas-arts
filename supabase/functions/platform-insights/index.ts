import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";

const TIKTOK_AUTHORIZE = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN = "https://open.tiktokapis.com/v2/oauth/token/";
const YOUTUBE_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function videoIdFromTikTok(value: string): string | null {
  const match = value.match(/\/video\/(\d+)/) ?? value.match(/^\s*(\d{8,})\s*$/);
  return match?.[1] ?? null;
}

async function freshTikTokToken(admin: ReturnType<typeof createClient>) {
  const clientKey = Deno.env.get("TIKTOK_CLIENT_KEY");
  const clientSecret = Deno.env.get("TIKTOK_CLIENT_SECRET");
  const { data: row } = await admin.from("tiktok_tokens").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!row || !clientKey || !clientSecret) return null;
  if (new Date(row.expires_at).getTime() > Date.now() + 120_000) return row.access_token as string;
  const response = await fetch(TIKTOK_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    }),
  });
  const token = await response.json();
  if (!response.ok || !token.access_token) return null;
  await admin.from("tiktok_tokens").update({
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? row.refresh_token,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", row.id);
  return token.access_token as string;
}

async function freshYouTubeToken(admin: ReturnType<typeof createClient>) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const { data: row } = await admin.from("platform_connections").select("*").eq("platform", "youtube").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!row || !clientId || !clientSecret) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() > Date.now() + 120_000) return row.access_token as string;
  if (!row.refresh_token) return null;
  const response = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    }),
  });
  const token = await response.json();
  if (!response.ok || !token.access_token) return null;
  await admin.from("platform_connections").update({
    access_token: token.access_token,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", row.id);
  return token.access_token as string;
}

async function syncTikTok(admin: ReturnType<typeof createClient>, publication: Record<string, unknown>) {
  const accessToken = await freshTikTokToken(admin);
  if (!accessToken || !publication.remote_content_id) return;
  const fields = "id,create_time,share_url,video_description,duration,like_count,comment_count,share_count,view_count";
  const response = await fetch(`https://open.tiktokapis.com/v2/video/query/?fields=${fields}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ filters: { video_ids: [publication.remote_content_id] } }),
  });
  const payload = await response.json();
  const video = payload?.data?.videos?.[0];
  if (!response.ok || !video) return;
  await admin.from("content_metrics").insert({
    publication_id: publication.id,
    views: video.view_count ?? null,
    likes: video.like_count ?? null,
    comments: video.comment_count ?? null,
    shares: video.share_count ?? null,
    raw: payload,
  });
  await admin.from("content_publications").update({
    remote_url: video.share_url ?? publication.remote_url,
    updated_at: new Date().toISOString(),
  }).eq("id", publication.id);
}

async function syncYouTube(admin: ReturnType<typeof createClient>, publication: Record<string, unknown>) {
  const accessToken = await freshYouTubeToken(admin);
  if (!accessToken || !publication.remote_content_id) return;
  const statsResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(String(publication.remote_content_id))}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const statsPayload = await statsResponse.json();
  const stats = statsPayload?.items?.[0]?.statistics;
  if (!statsResponse.ok || !stats) return;

  const publishedAt = publication.published_at ? new Date(String(publication.published_at)) : new Date(Date.now() - 30 * 86400000);
  const startDate = publishedAt.toISOString().slice(0, 10);
  const endDate = new Date().toISOString().slice(0, 10);
  const metrics = "views,engagedViews,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained,estimatedRevenue";
  const analyticsUrl = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  analyticsUrl.searchParams.set("ids", "channel==MINE");
  analyticsUrl.searchParams.set("startDate", startDate);
  analyticsUrl.searchParams.set("endDate", endDate);
  analyticsUrl.searchParams.set("metrics", metrics);
  analyticsUrl.searchParams.set("filters", `video==${publication.remote_content_id}`);
  const analyticsResponse = await fetch(analyticsUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  const analyticsPayload = analyticsResponse.ok ? await analyticsResponse.json() : null;
  const headers: string[] = analyticsPayload?.columnHeaders?.map((h: { name: string }) => h.name) ?? [];
  const row: unknown[] = analyticsPayload?.rows?.[0] ?? [];
  const analytics = Object.fromEntries(headers.map((name, i) => [name, row[i]]));

  await admin.from("content_metrics").insert({
    publication_id: publication.id,
    views: analytics.views ?? Number(stats.viewCount ?? 0),
    engaged_views: analytics.engagedViews ?? null,
    likes: analytics.likes ?? Number(stats.likeCount ?? 0),
    comments: analytics.comments ?? Number(stats.commentCount ?? 0),
    shares: analytics.shares ?? null,
    watch_time_seconds: analytics.estimatedMinutesWatched == null ? null : Number(analytics.estimatedMinutesWatched) * 60,
    average_view_duration_seconds: analytics.averageViewDuration ?? null,
    average_view_percentage: analytics.averageViewPercentage ?? null,
    subscribers_gained: analytics.subscribersGained ?? null,
    estimated_revenue_usd: analytics.estimatedRevenue ?? null,
    raw: { statistics: statsPayload, analytics: analyticsPayload },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersFor(req) });
  const cors = corsHeadersFor(req);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  const auth = await requireAuthorized(req);
  if (!auth.ok) return auth.response;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase credentials missing" }, 500);
  const admin = createClient(supabaseUrl, serviceKey);
  const body = await req.json().catch(() => ({}));
  const action = body.action ?? "status";

  if (action === "connect_url") {
    if (!auth.userId) return json({ error: "Interactive user required" }, 401);
    const platform = body.platform === "youtube" ? "youtube" : body.platform === "tiktok" ? "tiktok" : null;
    if (!platform) return json({ error: "platform must be tiktok or youtube" }, 400);
    const state = crypto.randomUUID() + crypto.randomUUID();
    await admin.from("platform_oauth_states").insert({
      state_hash: await sha256(state), platform, user_id: auth.userId,
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (platform === "tiktok") {
      const key = Deno.env.get("TIKTOK_CLIENT_KEY");
      if (!key) return json({ error: "TikTok client is not configured" }, 503);
      const redirect = `${supabaseUrl}/functions/v1/tiktok-oauth`;
      const url = new URL(TIKTOK_AUTHORIZE);
      url.searchParams.set("client_key", key);
      url.searchParams.set("scope", "user.info.basic,video.upload,video.list");
      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", redirect);
      url.searchParams.set("state", state);
      return json({ url: url.toString() });
    }
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    if (!clientId) return json({ error: "YouTube client is not configured" }, 503);
    const redirect = `${supabaseUrl}/functions/v1/youtube-oauth`;
    const url = new URL(YOUTUBE_AUTHORIZE);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirect);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    url.searchParams.set("scope", [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/yt-analytics.readonly",
    ].join(" "));
    return json({ url: url.toString() });
  }

  if (action === "link_tiktok") {
    const publicationId = typeof body.publication_id === "string" ? body.publication_id : "";
    const videoId = videoIdFromTikTok(String(body.video_url_or_id ?? ""));
    if (!publicationId || !videoId) return json({ error: "A publication and TikTok video URL are required" }, 400);
    const { data, error } = await admin.from("content_publications").update({
      status: "published",
      remote_content_id: videoId,
      remote_url: String(body.video_url_or_id),
      music_label: typeof body.music_label === "string" ? body.music_label.slice(0, 200) : null,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", publicationId).eq("platform", "tiktok").select("*").single();
    if (error) return json({ error: error.message }, 400);
    await syncTikTok(admin, data);
    return json({ publication: data });
  }

  if (action === "mark_published") {
    const publicationId = typeof body.publication_id === "string" ? body.publication_id : "";
    if (!publicationId) return json({ error: "publication_id is required" }, 400);
    const { data, error } = await admin.from("content_publications").update({
      status: "published",
      music_label: typeof body.music_label === "string" ? body.music_label.slice(0, 200) : null,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", publicationId).select("*").single();
    if (error) return json({ error: error.message }, 400);
    if (data.platform === "youtube") await syncYouTube(admin, data);
    if (data.platform === "tiktok" && data.remote_content_id) await syncTikTok(admin, data);
    return json({ publication: data });
  }

  if (action === "sync") {
    const { data: publications } = await admin.from("content_publications").select("*").eq("status", "published").not("remote_content_id", "is", null).limit(50);
    for (const publication of publications ?? []) {
      if (publication.platform === "tiktok") await syncTikTok(admin, publication);
      if (publication.platform === "youtube") await syncYouTube(admin, publication);
    }
  }

  const [{ data: tikTok }, { data: youtube }, { data: publications }, { data: costs }] = await Promise.all([
    admin.from("tiktok_tokens").select("open_id,scope,updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("platform_connections").select("account_id,account_name,scopes,updated_at").eq("platform", "youtube").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("content_publications").select("*, botanical_content(plant_name)").order("created_at", { ascending: false }).limit(50),
    admin.from("cost_events").select("estimated_cost_usd,actual_cost_usd,status,created_at").order("created_at", { ascending: false }).limit(500),
  ]);
  const publicationIds = (publications ?? []).map((p) => p.id);
  const { data: metrics } = publicationIds.length
    ? await admin.from("content_metrics").select("*").in("publication_id", publicationIds).order("captured_at", { ascending: false })
    : { data: [] };
  return json({ connections: { tiktok: tikTok, youtube }, publications: publications ?? [], metrics: metrics ?? [], costs: costs ?? [] });
});
