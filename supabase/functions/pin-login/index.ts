import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "../_shared/cors.ts";

const OWNER_EMAIL = "owner@botanical-studio.internal";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json" },
  });
}

async function hashClientAddress(req: Request, pepper: string) {
  const address =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const bytes = new TextEncoder().encode(`${address}|${pepper.slice(-24)}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeadersFor(req) });
  }
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json(req, { error: "Authentication is not configured" }, 500);
  }

  const body = await req.json().catch(() => ({}));
  const pin = typeof body?.pin === "string" ? body.pin : "";
  const ipHash = await hashClientAddress(req, serviceRoleKey);
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: result, error: verifyError } = await admin.rpc("authenticate_app_pin", {
    _passcode: pin,
    _ip_hash: ipHash,
  });
  if (verifyError || result === "not_configured") {
    console.error("PIN authentication configuration error", verifyError?.message);
    return json(req, { error: "Authentication is not configured" }, 500);
  }
  if (result === "rate_limited") {
    return json(req, { error: "Too many attempts" }, 429);
  }
  if (result !== "ok") {
    return json(req, { error: "Invalid PIN" }, 401);
  }

  const { data: members, error: membersError } = await admin
    .from("app_members")
    .select("user_id")
    .limit(2);
  if (membersError) return json(req, { error: "Unable to initialize owner" }, 500);

  let ownerId = members?.[0]?.user_id as string | undefined;
  if ((members?.length ?? 0) > 1) {
    return json(req, { error: "Owner configuration is invalid" }, 500);
  }

  if (!ownerId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: OWNER_EMAIL,
      email_confirm: true,
      user_metadata: { application: "botanical-studio", role: "owner" },
    });
    if (createError || !created.user) {
      console.error("Owner creation failed", createError?.message);
      return json(req, { error: "Unable to initialize owner" }, 500);
    }
    ownerId = created.user.id;
    const { error: memberInsertError } = await admin
      .from("app_members")
      .insert({ user_id: ownerId, role: "owner" });
    if (memberInsertError) {
      await admin.auth.admin.deleteUser(ownerId);
      console.error("Owner membership failed", memberInsertError.message);
      return json(req, { error: "Unable to initialize owner" }, 500);
    }
  }

  const { data: ownerData, error: ownerError } = await admin.auth.admin.getUserById(ownerId);
  const ownerEmail = ownerData.user?.email;
  if (ownerError || !ownerEmail) return json(req, { error: "Owner is unavailable" }, 500);

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: ownerEmail,
  });
  const tokenHash = linkData.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error("Session link generation failed", linkError?.message);
    return json(req, { error: "Unable to create session" }, 500);
  }

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: verified, error: otpError } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  const session = verified.session;
  if (otpError || !session) {
    console.error("Session verification failed", otpError?.message);
    return json(req, { error: "Unable to create session" }, 500);
  }

  return json(req, {
    success: true,
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    },
  });
});
