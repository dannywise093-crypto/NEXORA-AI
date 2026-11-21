const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
const json = (data, status=200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
const GRAPH_VERSION = (env) => env.WHATSAPP_GRAPH_VERSION || "v22.0";

async function verifySignature(raw, signature, secret) {
  if (!signature?.startsWith("sha256=") || !secret) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, raw));
  const hex = [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
  const supplied = signature.slice(7);
  if (hex.length !== supplied.length) return false;
  let diff = 0;
  for (let i=0;i<hex.length;i++) diff |= hex.charCodeAt(i) ^ supplied.charCodeAt(i);
  return diff === 0;
}

async function sendWhatsAppText(env, to, body) {
  const url = `https://graph.facebook.com/${GRAPH_VERSION(env)}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body: body.slice(0, 4096) } })
  });
  if (!response.ok) throw new Error(`WhatsApp send failed with HTTP ${response.status}`);
  return response.json();
}

async function askNexora(env, phone, text) {
  const history = await env.DB.prepare(
    "SELECT role, content FROM messages WHERE phone = ? ORDER BY created_at DESC LIMIT 12"
  ).bind(phone).all();
  const messages = (history.results || []).reverse().map((m) => ({ role: m.role, content: m.content }));
  messages.push({ role: "user", content: text });
  const response = await fetch(`${env.NEXORA_GATEWAY_URL.replace(/\/$/, "")}/api/chat`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.NEXORA_GATEWAY_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ messages })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.answer !== "string" || !data.answer.trim()) {
    throw new Error(`NEXORA gateway request failed with HTTP ${response.status}`);
  }
  return data.answer.trim().slice(0, 4096);
}

async function processWebhook(payload, env) {
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const message of value.messages || []) {
        if (!message.from || message.type !== "text" || !message.text?.body) continue;
        const phone = String(message.from);
        const body = String(message.text.body).trim().slice(0, 4000);
        if (!body || phone === String(value.metadata?.display_phone_number || "")) continue;
        const allowed = env.ALLOWED_PHONE_NUMBERS ? env.ALLOWED_PHONE_NUMBERS.split(",").map(x=>x.trim()).filter(Boolean) : [];
        if (allowed.length && !allowed.includes(phone)) continue;
        const exists = await env.DB.prepare("SELECT id FROM processed_messages WHERE message_id = ?").bind(message.id).first();
        if (exists) continue;
        await env.DB.prepare("INSERT OR IGNORE INTO processed_messages (message_id, created_at) VALUES (?, ?)")
          .bind(message.id, Date.now()).run();
        await env.DB.prepare("INSERT INTO messages (phone, role, content, created_at) VALUES (?, 'user', ?, ?)")
          .bind(phone, body, Date.now()).run();
        // Replies are deliberately disabled until the owner explicitly enables AUTO_REPLY_ENABLED.
        if (env.AUTO_REPLY_ENABLED !== "true") continue;
        const answer = await askNexora(env, phone, body);
        await sendWhatsAppText(env, phone, answer);
        await env.DB.prepare("INSERT INTO messages (phone, role, content, created_at) VALUES (?, 'assistant', ?, ?)")
          .bind(phone, answer, Date.now()).run();
      }
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ app: "NEXORA WhatsApp Intelligence", status: "running", autoReplyEnabled: env.AUTO_REPLY_ENABLED === "true", nexoraConfigured: Boolean(env.NEXORA_GATEWAY_URL && env.NEXORA_GATEWAY_TOKEN), whatsappConfigured: Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_APP_SECRET && env.WHATSAPP_VERIFY_TOKEN), storageConfigured: Boolean(env.DB) });
    }
    if (url.pathname !== "/webhook") return json({ error: "Not found" }, 404);
    if (request.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      if (mode === "subscribe" && token && env.WHATSAPP_VERIFY_TOKEN && token === env.WHATSAPP_VERIFY_TOKEN) {
        return new Response(challenge || "", { headers: { "content-type": "text/plain" } });
      }
      return json({ error: "Webhook verification failed" }, 403);
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    if (!env.DB || !env.WHATSAPP_APP_SECRET) return json({ error: "Webhook is not configured" }, 503);
    const raw = await request.arrayBuffer();
    const valid = await verifySignature(raw, request.headers.get("x-hub-signature-256"), env.WHATSAPP_APP_SECRET);
    if (!valid) return json({ error: "Invalid webhook signature" }, 401);
    let payload;
    try { payload = JSON.parse(new TextDecoder().decode(raw)); } catch { return json({ error: "Invalid JSON" }, 400); }
    try { await processWebhook(payload, env); }
    catch (error) { console.error("NEXORA WhatsApp processing error", error?.message || "unknown"); return json({ error: "Message processing failed" }, 500); }
    return json({ received: true });
  }
};