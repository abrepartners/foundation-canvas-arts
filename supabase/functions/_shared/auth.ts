// Shared owner guard for protected Edge Functions.
// Accepts the app passcode header from the client, or the service-role key for
// internal edge-to-edge invocations.
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

  if (serviceKey && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length).trim();
    if (token && token === serviceKey) {
      return { ok: true, internal: true, userId: null };
    }
  }

  const passcode = req.headers.get("x-app-passcode");
  const expected = Deno.env.get("APP_PASSCODE");
  if (!expected) {
    return { ok: false, response: unauthorized("Passcode not configured") };
  }
  if (!passcode || passcode !== expected) {
    return { ok: false, response: unauthorized() };
  }

  // Passcode auth is single-owner; interactive user id is not available here.
  // Platform connect flows that need a real auth.users id should set OWNER_USER_ID.
  const ownerId = Deno.env.get("OWNER_USER_ID");
  return { ok: true, internal: false, userId: ownerId ?? null };
}
