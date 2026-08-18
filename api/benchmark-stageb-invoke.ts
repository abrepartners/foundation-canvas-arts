export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET only" });
    return;
  }

  const key = typeof req.query?.key === "string" ? req.query.key : "";
  const action = typeof req.query?.action === "string" ? req.query.action : "submit";
  const idsRaw = typeof req.query?.ids === "string" ? req.query.ids : "";

  if (!key) {
    res.status(404).json({ error: "not found" });
    return;
  }

  const body: Record<string, unknown> = { action };
  if (action === "status" && idsRaw) {
    body.ids = idsRaw.split(",").map((x: string) => x.trim()).filter(Boolean).slice(0, 4);
  }

  try {
    const upstream = await fetch(
      "https://thxkzaazwkdtacfvdiyn.functions.supabase.co/adaptive-reuse-stageb-replicate-oneshot",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-benchmark-key": key,
        },
        body: JSON.stringify(body),
      },
    );

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("content-type", upstream.headers.get("content-type") || "application/json");
    res.setHeader("cache-control", "no-store");
    res.send(text);
  } catch (error: any) {
    res.status(502).json({ error: error?.message || "upstream request failed" });
  }
}
