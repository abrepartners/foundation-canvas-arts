const SUPABASE_URL = "https://pswlaczoevrclemhjjpw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzd2xhY3pvZXZyY2xlbWhqanB3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NTg0OTMsImV4cCI6MjA4MzQzNDQ5M30.PTAWb77MTkNP_99XOe0vl6Zup7SCXpLGSEqsg2t_SXM";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed" });
  }

  const name = Array.isArray(request.query.name)
    ? request.query.name[0]
    : request.query.name;
  if (!name || !/^[a-z0-9-]+$/.test(name)) {
    return response.status(400).json({ error: "Invalid function name" });
  }

  const authorization = request.headers.authorization;
  const upstream = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: authorization || `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request.body ?? {}),
  });

  const body = await upstream.text();
  response.status(upstream.status);
  response.setHeader(
    "Content-Type",
    upstream.headers.get("content-type") || "application/json",
  );
  response.setHeader("Cache-Control", "no-store");
  return response.send(body);
}
