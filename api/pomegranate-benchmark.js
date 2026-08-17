export default async function handler(req, res) {
  const action = typeof req.query?.action === "string" ? req.query.action : "info";
  if (!["info", "submit", "status"].includes(action)) {
    return res.status(400).json({ error: "invalid action" });
  }

  const target = new URL(
    "https://thxkzaazwkdtacfvdiyn.supabase.co/functions/v1/replicate-pomegranate-benchmark",
  );
  target.searchParams.set("action", action);
  target.searchParams.set(
    "key",
    "-IVICs-su-C8F2tzrpPBLpzoGfFh0xpmUHvKvPjzLUs",
  );

  const response = await fetch(target);
  const text = await response.text();
  res.status(response.status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  return res.send(text);
}
