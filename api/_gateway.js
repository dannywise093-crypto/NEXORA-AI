const GATEWAY_FALLBACK = "https://atlas-model-gateway.dannywise093.workers.dev";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}

export async function forward(req, res, path, method) {
  if (req.method !== method) return sendJson(res, 405, { error: "Method not allowed." });
  const token = process.env.ATLAS_GATEWAY_TOKEN;
  const baseUrl = String(process.env.ATLAS_GATEWAY_URL || GATEWAY_FALLBACK).replace(/\/+$/, "");
  if (!token) return sendJson(res, 503, { error: "The secured Cloudflare gateway token is not configured in Vercel." });

  let body;
  if (method === "POST") {
    body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { return sendJson(res, 400, { error: "A valid JSON body is required." }); }
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return sendJson(res, 400, { error: "A JSON object is required." });
  }

  try {
    const upstream = await fetch(baseUrl + path, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(110_000),
    });
    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", upstream.headers.get("Content-Type") || "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(text);
  } catch {
    sendJson(res, 502, { error: "The Cloudflare AI gateway could not be reached.", retryable: true });
  }
}

export { sendJson };
