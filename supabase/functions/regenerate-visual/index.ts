import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content_id, moment, prompt } = await req.json();

    if (!content_id || !moment || !prompt) {
      throw new Error("Missing required fields: content_id, moment, prompt");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log(`Regenerating image for content ${content_id}, moment: ${moment}`);

    // Generate image
    const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"]
      }),
    });

    if (!imageResponse.ok) {
      console.error("Image API error:", imageResponse.status);
      throw new Error(`Image generation failed: ${imageResponse.status}`);
    }

    const imageData = await imageResponse.json();
    console.log("Image API response received");

    // Defensive parsing
    const base64Image = imageData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!base64Image || typeof base64Image !== "string") {
      console.error("No valid image data in response");
      throw new Error("No image data received from AI");
    }

    // Extract base64 and convert to binary
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Upload to storage (upsert to replace existing)
    const filePath = `${content_id}/${moment}.png`;

    const { error: uploadError } = await supabase.storage
      .from("botanical-faceless-visuals")
      .upload(filePath, imageBuffer, {
        contentType: "image/png",
        upsert: true
      });

    if (uploadError) {
      console.error("Upload failed:", uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from("botanical-faceless-visuals")
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;
    console.log("Image uploaded successfully:", publicUrl);

    // Update the visual in the database
    const { data: contentRow, error: fetchError } = await supabase
      .from("botanical_content")
      .select("script_visuals")
      .eq("id", content_id)
      .single();

    if (fetchError || !contentRow) {
      console.error("Failed to fetch content:", fetchError);
      throw new Error("Content not found");
    }

    let visuals = [];
    try {
      visuals = JSON.parse(contentRow.script_visuals || "[]");
    } catch {
      visuals = [];
    }

    // Update the specific visual's image_url
    const updatedVisuals = visuals.map((v: { moment: string; prompt: string; image_url?: string }) => 
      v.moment === moment ? { ...v, image_url: publicUrl } : v
    );

    const { error: updateError } = await supabase
      .from("botanical_content")
      .update({ script_visuals: JSON.stringify(updatedVisuals) })
      .eq("id", content_id);

    if (updateError) {
      console.error("Failed to update content:", updateError);
      // Don't throw - image is uploaded, just DB update failed
    }

    return new Response(JSON.stringify({
      success: true,
      image_url: publicUrl,
      moment
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in regenerate-visual:", message);
    return new Response(JSON.stringify({
      success: false,
      error: message
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
