// Shared owner guard for protected Edge Functions.
// Accepts an explicit app member's Supabase JWT, or the service-role key for
// internal edge-to-edge invocations.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "./cors.ts";

export type AuthResult =
  | { ok: true; internal: boolean; userId: string | null }
  | { ok: false; response: Response };

export async function requireAuthorized(req: Request): Promise<AuthResult> {
  const cors = corsHeadersFor(req);
  const unauthorized = (msg = "Unauthorized") =>
    new Response(JSON.stringify({ error: msg }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  const authHeader = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (serviceKey && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token && token === serviceKey) {
      return { ok: true, internal: true, userId: null };
    }
  }

  if (!serviceKey || !supabaseUrl || !authHeader.startsWith("Bearer ")) {
    return { ok: false, response: unauthorized() };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return { ok: false, response: unauthorized() };

  const { data: member } = await admin
    .from("app_members")
    .select("user_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!member) {
    return { ok: false, response: unauthorized("Account is not approved for this app") };
  }
  return { ok: true, internal: false, userId: userData.user.id };
}
