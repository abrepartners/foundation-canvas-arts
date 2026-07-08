// Shared auth guard for protected edge functions.
// Accepts either the single authorized user's Supabase JWT, or the project
// service role key (used for internal edge-to-edge invocations).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeadersFor } from "./cors.ts";

const ALLOWED_EMAIL = "info@nuelementsmedia.com";

export type AuthResult =
  | { ok: true; internal: boolean; email: string | null }
  | { ok: false; response: Response };

export async function requireAuthorized(req: Request): Promise<AuthResult> {
  const cors = corsHeadersFor(req);
  const unauthorized = (msg = "Unauthorized") =>
    new Response(JSON.stringify({ error: msg }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, response: unauthorized() };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return { ok: false, response: unauthorized() };

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && token === serviceKey) {
    return { ok: true, internal: true, email: null };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return { ok: false, response: unauthorized() };

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.auth.getUser();
  const email = data?.user?.email?.toLowerCase() ?? null;
  if (error || !email || email !== ALLOWED_EMAIL) {
    return { ok: false, response: unauthorized("Forbidden") };
  }
  return { ok: true, internal: false, email };
}
