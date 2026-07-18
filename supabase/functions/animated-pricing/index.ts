// Read-only pricing endpoint. Single source of truth for the animation cost
// confirmation handshake so the client cannot go stale.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";
import {
  ANIMATION_CLIP_COUNT,
  ANIMATION_CLIP_SECONDS,
  ANIMATION_MODE,
  paidAnimationEstimate,
  PRICING_VERSION,
  stillsCost,
} from "../_shared/pricing.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeadersFor(req) });
  const cors = corsHeadersFor(req);
  const auth = await requireAuthorized(req);
  if (!auth.ok) return auth.response;

  const paid = paidAnimationEstimate();
  const body = {
    pricing_version: PRICING_VERSION,
    clip_count: ANIMATION_CLIP_COUNT,
    clip_seconds: ANIMATION_CLIP_SECONDS,
    mode: ANIMATION_MODE,
    stills: stillsCost(ANIMATION_CLIP_COUNT),
    clips: paid.clips,
    stitch: paid.stitch,
    paid_total_usd: paid.total_usd,
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
