const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/tiktok";

interface Body {
  title?: string;
  description?: string;
  photo_images: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TIKTOK_API_KEY = Deno.env.get("TIKTOK_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
    if (!TIKTOK_API_KEY)
      throw new Error("TIKTOK_API_KEY is not configured (connect TikTok)");

    const body = (await req.json()) as Body;
    const images = Array.isArray(body.photo_images)
      ? body.photo_images.filter(
          (u) => typeof u === "string" && u.startsWith("http"),
        )
      : [];
    if (images.length < 2 || images.length > 35) {
      return new Response(
        JSON.stringify({ error: "photo_images must contain 2-35 public URLs" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const title = (body.title ?? "").toString().slice(0, 90);
    const description = (body.description ?? "").toString().slice(0, 4000);

    const payload = {
      post_info: {
        title,
        description,
        disable_comment: false,
        auto_add_music: true,
      },
      source_info: {
        source: "PULL_FROM_URL",
        photo_cover_index: 0,
        photo_images: images,
      },
      post_mode: "MEDIA_UPLOAD",
      media_type: "PHOTO",
    };

    const tiktokRes = await fetch(`${GATEWAY_URL}/post/publish/content/init/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TIKTOK_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await tiktokRes.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }

    if (!tiktokRes.ok) {
      return new Response(
        JSON.stringify({
          error: "TikTok rejected the request",
          status: tiktokRes.status,
          details: json,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ ok: true, tiktok: json }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
