// Per-request CORS headers restricted to this app's origins.
const DEFAULT_ORIGIN = "https://foundation-canvas-arts.lovable.app";

function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host.endsWith(".lovable.app")) return true;
    if (host.endsWith(".lovableproject.com")) return true;
    if (host.endsWith(".lovable.dev")) return true;
    return false;
  } catch {
    return false;
  }
}

export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const configuredOrigin = Deno.env.get("APP_ORIGIN") ?? DEFAULT_ORIGIN;
  const allow = origin === configuredOrigin || isAllowedOrigin(origin) ? origin : configuredOrigin;
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",

    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}
