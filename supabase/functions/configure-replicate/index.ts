import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeadersFor } from "../_shared/cors.ts";
import { requireAuthorized } from "../_shared/auth.ts";
import { getReplicateApiKey, setStoredSecret } from "../_shared/secrets.ts";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json" },
  });
}

async function verifyToken(token: string): Promise<{ username: string | null }> {
  const response = await fetch("https://api.replicate.com/v1/account", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Replicate rejected this API token");
  const account = await response.json().catch(() => ({}));
  return { username: typeof account?.username === "string" ? account.username : null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeadersFor(req) });
  const auth = await requireAuthorized(req);
  if (!auth.ok) return auth.response;
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "status";
    if (action === "status") {
      const token = await getReplicateApiKey();
      if (!token) return json(req, { connected: false });
      try {
        const account = await verifyToken(token);
        return json(req, { connected: true, username: account.username });
      } catch {
        return json(req, { connected: false, needs_reconnect: true });
      }
    }
    if (action !== "connect") return json(req, { error: "Invalid action" }, 400);

    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!token.startsWith("r8_") || token.length < 20 || token.length > 256) {
      return json(req, { error: "Enter a valid Replicate API token" }, 400);
    }

    const account = await verifyToken(token);
    await setStoredSecret("REPLICATE_API_KEY", token);
    return json(req, { connected: true, username: account.username });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to connect Replicate";
    return json(req, { error: message }, 400);
  }
});
