// Per-request CORS headers restricted to this app's origins.
const ALLOWED_ORIGINS = new Set([
  "https://foundation-canvas-arts.lovable.app",
  "https://id-preview--2dc683a5-50ba-401b-94db-7cc9b6c8ca80.lovable.app",
  "http://localhost:8080",
  "http://localhost:5173",
]);

const DEFAULT_ORIGIN = "https://foundation-canvas-arts.lovable.app";

export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-app-passcode",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  };
}
