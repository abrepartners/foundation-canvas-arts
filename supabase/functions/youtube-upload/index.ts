// Uploads one completed vertical video to YouTube as PRIVATE by default.
// The owner reviews it in YouTube Studio and publishes manually. One request
// maps to one durable publication through a server-enforced idempotency key.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";

async function freshAccessToken(admin: ReturnType<typeof createClient>) {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const { data: row } = await admin.from("platform_connections").select("*")
    .eq("platform", "youtube").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!row || !clientId || !clientSecret) throw new Error("YouTube is not connected");
  if (row.expires_at && new Date(row.expires_at).getTime() > Date.now() + 120_000) return row.access_token as string;
  if (!row.refresh_token) throw new Error("YouTube must be reconnected");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token", refresh_token: row.refresh_token }),
  });
  const token = await response.json();
  if (!response.ok || !token.access_token) throw new Error("YouTube token refresh failed");
  await admin.from("platform_connections").update({
    access_token: token.access_token,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("id", row.id);
  return token.access_token as string;
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
  const animatedId = typeof body.animated_id === "string" ? body.animated_id : "";
  const promptLabJobId = typeof body.prompt_lab_job_id === "string" ? body.prompt_lab_job_id : "";
  const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key : "";
  if ((!animatedId && !promptLabJobId) || !idempotencyKey) return json({ error: "A completed animation and idempotency_key are required" }, 400);

  const { data: existing } = await admin.from("content_publications").select("*").eq("idempotency_key", idempotencyKey).maybeSingle();
  if (existing) return json({ publication: existing, duplicate: true });
  let resolvedAnimatedId = animatedId;
  let sourceUrl: string | null = null;
  let experiment: Record<string, unknown> = typeof body.experiment === "object" && body.experiment ? body.experiment : {};
  if (promptLabJobId) {
    const { data: lab } = await admin.from("animation_prompt_lab_jobs")
      .select("animation_row_id,output_url,status,archetype,model_key,prompt_version,estimated_cost_usd")
      .eq("id", promptLabJobId).maybeSingle();
    if (!lab || lab.status !== "succeeded" || !lab.output_url) return json({ error: "A completed Prompt Lab video is required" }, 400);
    resolvedAnimatedId = lab.animation_row_id;
    sourceUrl = lab.output_url;
    experiment = { ...experiment, archetype: lab.archetype, model_key: lab.model_key, prompt_version: lab.prompt_version, estimated_cost_usd: lab.estimated_cost_usd };
  }
  const { data: animation } = await admin.from("botanical_animated").select("id,source_content_id,plant_name,caption,final_video_url")
    .eq("id", resolvedAnimatedId).maybeSingle();
  sourceUrl = sourceUrl ?? animation?.final_video_url ?? null;
  if (!animation || !sourceUrl) return json({ error: "A completed animation video is required" }, 400);

  const title = String(body.title ?? animation.plant_name ?? "Botanical discovery").slice(0, 100);
  const description = String(body.description ?? animation.caption ?? "").slice(0, 5000);
  const { data: publication, error: insertError } = await admin.from("content_publications").insert({
    botanical_content_id: animation.source_content_id,
    animated_id: resolvedAnimatedId,
    platform: "youtube",
    delivery_mode: "private",
    status: "uploading",
    idempotency_key: idempotencyKey,
    title,
    caption: description,
    experiment,
  }).select("*").single();
  if (insertError || !publication) return json({ error: insertError?.message ?? "Publication could not be created" }, 409);

  try {
    const accessToken = await freshAccessToken(admin);
    const sourceResponse = await fetch(sourceUrl);
    if (!sourceResponse.ok) throw new Error("Final video could not be downloaded from storage");
    const bytes = new Uint8Array(await sourceResponse.arrayBuffer());
    const metadata = {
      snippet: { title, description, categoryId: "27" },
      status: { privacyStatus: "private", selfDeclaredMadeForKids: false },
    };
    const initResponse = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(bytes.byteLength),
        "X-Upload-Content-Type": "video/mp4",
      },
      body: JSON.stringify(metadata),
    });
    const uploadUrl = initResponse.headers.get("Location");
    if (!initResponse.ok || !uploadUrl) throw new Error("YouTube upload session could not be initialized");
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4", "Content-Length": String(bytes.byteLength) },
      body: bytes,
    });
    const result = await uploadResponse.json();
    if (!uploadResponse.ok || !result.id) throw new Error(result?.error?.message ?? "YouTube upload failed");
    const { data: updated } = await admin.from("content_publications").update({
      status: "delivered",
      remote_content_id: result.id,
      remote_url: `https://www.youtube.com/shorts/${result.id}`,
      delivered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", publication.id).select("*").single();
    return json({ publication: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await admin.from("content_publications").update({ status: "failed", error: message, updated_at: new Date().toISOString() }).eq("id", publication.id);
    return json({ error: message, publication_id: publication.id }, 502);
  }
});
