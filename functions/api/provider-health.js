import { proxy } from "./_gateway.js";

export async function onRequestGet({ request, env }) {
  return proxy(request, env, "/api/provider-health", "GET");
}

export async function onRequest({ request }) {
  return new Response(JSON.stringify({ error: "Method not allowed." }), {
    status: 405,
    headers: { Allow: "GET", "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
