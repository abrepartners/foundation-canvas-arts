// Shared owner guard for protected Edge Functions.
// Accepts a real Supabase Auth session JWT belonging to an app_members row,
// or the service-role key for internal edge-to-edge invocations.
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
  if (!authHeader.startsWith("Bearer ")) return { ok: false, response: unauthorized() };
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return { ok: false, response: unauthorized() };

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, response: unauthorized("Auth not configured") };
  }

  // Internal edge-to-edge calls use the service-role key directly.
  if (token === serviceKey) {
    return { ok: true, internal: true, userId: null };
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin.auth.getUser(token);
  const user = data?.user;
  if (error || !user) return { ok: false, response: unauthorized() };

  const { data: member, error: memberError } = await admin
    .from("app_members")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberError || !member) {
    return { ok: false, response: unauthorized("Not an app member") };
  }

  return { ok: true, internal: false, userId: user.id };
}
