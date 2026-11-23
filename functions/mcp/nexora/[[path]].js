const MAX_BODY_BYTES = 40 * 1024;
const MCP_PROTOCOL_VERSION = "2025-11-25";
const GATEWAY_URL = "https://atlas-model-gateway.dannywise093.workers.dev/api/chat";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function rpcError(id, code, message) {
  return json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

function validBearer(request, expected) {
  const match = (request.headers.get("Authorization") || "").match(/^Bearer ([^ ]+)$/i);
  if (!match || typeof expected !== "string" || !expected) return false;
  const supplied = new TextEncoder().encode(match[1]);
  const required = new TextEncoder().encode(expected);
  if (supplied.length !== required.length) return false;
  let difference = 0;
  for (let i = 0; i < supplied.length; i++) difference |= supplied[i] ^ required[i];
  return difference === 0;
}

function configuration(env) {
  const mcpToken = env.NEXORA_DEERFLOW_MCP_TOKEN;
  const gatewayToken = env.ATLAS_GATEWAY_TOKEN;
  if (typeof mcpToken !== "string" || mcpToken.length < 32 ||
      typeof gatewayToken !== "string" || gatewayToken.length < 32) return null;
  return { mcpToken, gatewayToken };
}

const TOOLS = [{
  name: "run_nexora_research",
  description: "Run a live research investigation through the existing NEXORA Cloudflare AI gateway. This invokes NEXORA's research-mode search and multi-agent synthesis workflow and returns its answer, source metadata, and execution summary. This is the currently deployed NEXORA research workflow; it is not the separate NVIDIA Deep Researcher Python job service and does not claim to invoke the 200 Python specialist subagents.",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        minLength: 1,
        maxLength: 12000,
        description: "A clear research question. Include scope, timeframe, and desired depth."
      }
    },
    required: ["query"],
    additionalProperties: false
  }
}];

function toolResult(id, data, isError = false) {
  return json({
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: data,
      isError
    }
  });
}

async function runResearch(query, config) {
  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + config.gatewayToken,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: query.trim() }],
      researchMode: true,
      agentMode: true
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error("The NEXORA gateway returned HTTP " + response.status + ".");
  }
  if (typeof payload.answer !== "string" || !payload.answer.trim()) {
    throw new Error("The NEXORA gateway returned no research answer.");
  }
  return {
    status: payload.reportComplete === false ? "partial" : "completed",
    answer: payload.answer.trim(),
    provider: payload.provider || null,
    model: payload.model || null,
    orchestration: payload.orchestration || null,
    agents: Array.isArray(payload.agents) ? payload.agents : [],
    reviewer: payload.reviewer || null,
    executionSummary: payload.executionSummary || null,
    sourceAudit: payload.sourceAudit || null,
    sources: Array.isArray(payload.research?.sources) ? payload.research.sources : [],
    researchProviders: Array.isArray(payload.research?.providers) ? payload.research.providers : [],
    reportComplete: payload.reportComplete !== false,
    backend: "atlas-model-gateway"
  };
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return json({ error: "MCP Streamable HTTP requests must use POST." }, 405, { Allow: "POST" });
  }
  const config = configuration(env);
  if (!config) {
    return json({
      error: "NEXORA DeerFlow MCP is not configured. Add the two required Cloudflare secrets.",
      code: "mcp_not_configured"
    }, 503);
  }
  if (!validBearer(request, config.mcpToken)) {
    return json({ error: "Unauthorized MCP client." }, 401, { "WWW-Authenticate": "Bearer" });
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return json({ error: "MCP request body is too large." }, 413);
  }
  let message;
  try { message = JSON.parse(raw); }
  catch { return rpcError(null, -32700, "Parse error."); }
  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message?.id, -32600, "Invalid Request.");
  }
  if (message.method === "notifications/initialized" || message.method.startsWith("notifications/")) {
    return new Response(null, { status: 202, headers: { "Cache-Control": "no-store" } });
  }
  const id = Object.prototype.hasOwnProperty.call(message, "id") ? message.id : null;
  if (message.method === "initialize") {
    return json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "nexora-cloudflare-research", version: "1.0.0" }
      }
    });
  }
  if (message.method === "ping") return json({ jsonrpc: "2.0", id, result: {} });
  if (message.method === "tools/list") return json({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
  if (message.method === "tools/call") {
    const params = message.params || {};
    if (params.name !== "run_nexora_research") {
      return rpcError(id, -32602, "Unknown tool. Available tool: run_nexora_research.");
    }
    const query = params.arguments?.query;
    if (typeof query !== "string" || !query.trim() || query.length > 12000) {
      return toolResult(id, { error: "query must contain between 1 and 12,000 characters." }, true);
    }
    try {
      return toolResult(id, await runResearch(query, config));
    } catch (error) {
      return toolResult(id, {
        error: "NEXORA research could not be completed.",
        detail: String(error?.message || "Unknown gateway error.").slice(0, 240),
        retryable: true
      }, true);
    }
  }
  return rpcError(id, -32601, "Method not found.");
}

export const nexoraGatewayMcpInternals = { configuration, validBearer, runResearch };
