const MAX_BODY_BYTES = 40 * 1024;
const MCP_PROTOCOL_VERSION = "2025-11-25";
const JOB_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

function rpcError(id, code, message) {
  return json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

function validBearer(request, expected) {
  const value = request.headers.get("Authorization") || "";
  const match = value.match(/^Bearer ([^ ]+)$/i);
  if (!match) return false;
  const supplied = new TextEncoder().encode(match[1]);
  const required = new TextEncoder().encode(expected);
  if (supplied.length !== required.length) return false;
  let difference = 0;
  for (let index = 0; index < supplied.length; index++) difference |= supplied[index] ^ required[index];
  return difference === 0;
}

function configuration(env) {
  const baseUrl = String(env.DEEP_RESEARCHER_URL || "").replace(/\/+$/, "");
  const backendToken = env.NEXORA_RESEARCH_API_TOKEN;
  const mcpToken = env.NEXORA_DEERFLOW_MCP_TOKEN;
  let backend;
  try { backend = new URL(baseUrl); } catch { backend = null; }
  const secureTransport = backend && (backend.protocol === "https:" ||
    (["localhost", "127.0.0.1"].includes(backend.hostname) && backend.protocol === "http:"));
  if (!baseUrl || !backendToken || backendToken.length < 32 || !secureTransport ||
      backend.username || backend.password || !mcpToken || mcpToken.length < 32) return null;
  return { baseUrl, backendToken, mcpToken };
}

async function backendRequest(config, route, method = "GET", body) {
  const response = await fetch(config.baseUrl + "/v1/jobs/async/" + route, {
    method,
    headers: {
      Authorization: "Bearer " + config.backendToken,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("The NVIDIA Deep Research backend rejected the request.");
  return payload;
}

const TOOLS = [
  {
    name: "list_research_agents",
    description: "List top-level NVIDIA Deep Research workflows exposed by the connected backend. The 200 NEXORA specialists are internal on-demand subagents of the deep_researcher workflow, not 200 separately hosted API services.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false }
  },
  {
    name: "submit_query",
    description: "Submit a research question to the real NVIDIA Deep Researcher workflow. The workflow selects and delegates to its registered NEXORA specialist subagents as needed. Returns a job_id and state; if queued, poll with poll_query, then call get_final_report when complete.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", minLength: 1, maxLength: 32768, description: "Research question to investigate." } },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "poll_query",
    description: "Check the status of an NVIDIA Deep Research job. Continue polling while queued or running. When complete, call get_final_report.",
    inputSchema: {
      type: "object",
      properties: { job_id: { type: "string", minLength: 1, maxLength: 80 } },
      required: ["job_id"],
      additionalProperties: false
    }
  },
  {
    name: "get_final_report",
    description: "Retrieve the completed report for an NVIDIA Deep Research job.",
    inputSchema: {
      type: "object",
      properties: { job_id: { type: "string", minLength: 1, maxLength: 80 } },
      required: ["job_id"],
      additionalProperties: false
    }
  }
];

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

function normalizeState(payload) {
  const raw = String(payload.state || payload.status || payload.job?.status || payload.job_info?.status || "")
    .toLowerCase();
  if (["queued", "submitted", "pending", "accepted"].includes(raw)) return "queued";
  if (["running", "in_progress", "processing"].includes(raw)) return "running";
  if (["success", "successful", "completed", "complete"].includes(raw)) return "complete";
  if (["failure", "failed", "error", "cancelled", "canceled", "interrupted"].includes(raw)) return "failed";
  return raw || "unknown";
}

async function callTool(name, args, config) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new TypeError("Tool arguments must be a JSON object.");
  }
  if (name === "list_research_agents") {
    const payload = await backendRequest(config, "agents");
    return { agents: Array.isArray(payload.agents) ? payload.agents : [] };
  }
  if (name === "submit_query") {
    const query = args.query;
    if (typeof query !== "string" || !query.trim() || query.length > 32768) {
      throw new TypeError("query must contain between 1 and 32,768 characters.");
    }
    const payload = await backendRequest(config, "submit", "POST", {
      agent_type: "deep_researcher",
      input: query.trim()
    });
    if (typeof payload.job_id !== "string" || !payload.job_id) {
      throw new Error("The NVIDIA backend did not return a research job identifier.");
    }
    return {
      job_id: payload.job_id,
      depth: payload.depth || "deep",
      state: normalizeState(payload),
      estimated_duration_seconds: payload.estimated_duration_seconds,
      first_poll_after_seconds: payload.first_poll_after_seconds
    };
  }
  if (name === "poll_query" || name === "get_final_report") {
    const jobId = args.job_id;
    if (typeof jobId !== "string" || !JOB_ID_PATTERN.test(jobId)) {
      throw new TypeError("job_id must be a valid research job identifier.");
    }
    const action = name === "poll_query" ? "" : "/report";
    const payload = await backendRequest(config, "job/" + encodeURIComponent(jobId) + action);
    if (name === "poll_query") {
      return {
        job_id: jobId,
        state: normalizeState(payload),
        status: payload.status || payload.job?.status || payload.job_info?.status || payload.state || null,
        progress: payload.progress ?? payload.job?.progress ?? null,
        todos: Array.isArray(payload.todos) ? payload.todos : []
      };
    }
    const report = payload.report || payload.markdown || payload.content || payload.answer;
    if (typeof report !== "string" || !report.trim()) {
      return { job_id: jobId, state: normalizeState(payload), error: "report_not_ready" };
    }
    return {
      job_id: jobId,
      state: "complete",
      report: report.trim(),
      sources: Array.isArray(payload.sources) ? payload.sources : []
    };
  }
  throw new RangeError("Unknown NVIDIA Deep Research tool.");
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return json({ error: "MCP Streamable HTTP requests must use POST." }, 405, { Allow: "POST" });
  }

  const config = configuration(env);
  if (!config) {
    return json({ error: "The NEXORA NVIDIA MCP bridge is not configured.", code: "mcp_not_configured" }, 503);
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
        serverInfo: { name: "nexora-nvidia-deep-research", version: "1.0.0" }
      }
    });
  }

  if (message.method === "ping") return json({ jsonrpc: "2.0", id, result: {} });
  if (message.method === "tools/list") return json({ jsonrpc: "2.0", id, result: { tools: TOOLS } });

  if (message.method === "tools/call") {
    const params = message.params || {};
    if (typeof params.name !== "string") return rpcError(id, -32602, "A tool name is required.");
    try {
      const data = await callTool(params.name, params.arguments || {}, config);
      return toolResult(id, data);
    } catch (error) {
      const messageText = error instanceof TypeError || error instanceof RangeError
        ? error.message
        : "The NVIDIA Deep Research operation failed. Check backend health and configuration.";
      return toolResult(id, { error: messageText }, true);
    }
  }

  return rpcError(id, -32601, "Method not found.");
}

export const nexoraNvidiaMcpInternals = { configuration, normalizeState, validBearer, callTool };
