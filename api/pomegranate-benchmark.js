export default async function handler(req, res) {
  const action = typeof req.query?.action === "string" ? req.query.action : "submit";
  if (!["submit", "status"].includes(action)) {
    return res.status(400).json({ error: "invalid action" });
  }

  const body = { action };
  if (action === "status" && typeof req.query?.ids === "string") {
    body.ids = req.query.ids.split(",").map((id) => id.trim()).filter(Boolean).slice(0, 4);
  }

  const response = await fetch(
    "https://thxkzaazwkdtacfvdiyn.functions.supabase.co/adaptive-reuse-stageb-replicate-oneshot",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-benchmark-key": "stageb-rp-4f3e9d1c-20260817",
      },
      body: JSON.stringify(body),
    },
  );

  const text = await response.text();
  res.status(response.status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  return res.send(text);
}
