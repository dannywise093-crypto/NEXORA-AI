import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "./[[path]].js";

const TOKEN = "nexora-deerflow-mcp-test-token-012345678901234567890123456789";
const ENV = {
  DEEP_RESEARCHER_URL: "https://research.example",
  NEXORA_RESEARCH_API_TOKEN: "nexora-backend-token-012345678901234567890123456789",
  NEXORA_DEERFLOW_MCP_TOKEN: TOKEN
};

function request(body, authorization = "Bearer " + TOKEN) {
  return new Request("https://nexora.example/mcp/nvidia", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {})
    },
    body: JSON.stringify(body)
  });
}

test("NVIDIA MCP bridge requires its own service bearer token", async () => {
  const response = await onRequest({
    request: request({ jsonrpc: "2.0", id: 1, method: "initialize" }, ""),
    env: ENV
  });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("www-authenticate"), "Bearer");
});

test("NVIDIA MCP bridge exposes the research tools through MCP", async () => {
  const response = await onRequest({
    request: request({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    env: ENV
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(payload.result.tools.map(tool => tool.name), [
    "list_research_agents",
    "submit_query",
    "poll_query",
    "get_final_report"
  ]);
  assert.match(payload.result.tools.find(tool => tool.name === "submit_query").description, /200 NEXORA specialist subagents/);
});

test("NVIDIA MCP bridge maps a real backend submission to an MCP tool result", async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = "";
  let calledBody;
  globalThis.fetch = async (url, options) => {
    calledUrl = String(url);
    calledBody = JSON.parse(options.body);
    assert.equal(options.headers.Authorization, "Bearer " + ENV.NEXORA_RESEARCH_API_TOKEN);
    return new Response(JSON.stringify({
      job_id: "job_abc123",
      depth: "deep",
      state: "queued",
      estimated_duration_seconds: 180,
      first_poll_after_seconds: 180
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const response = await onRequest({
      request: request({
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: { name: "submit_query", arguments: { query: "Research this topic" } }
      }),
      env: ENV
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(calledUrl, "https://research.example/v1/jobs/async/submit");
    assert.deepEqual(calledBody, { agent_type: "deep_researcher", input: "Research this topic" });
    assert.equal(payload.result.isError, false);
    assert.equal(payload.result.structuredContent.job_id, "job_abc123");
    assert.equal(payload.result.structuredContent.state, "queued");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("NVIDIA MCP bridge normalizes backend job states", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ status: "SUCCESS" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
  try {
    const response = await onRequest({
      request: request({
        jsonrpc: "2.0",
        id: 8,
        method: "tools/call",
        params: { name: "poll_query", arguments: { job_id: "job_abc123" } }
      }),
      env: ENV
    });
    const payload = await response.json();
    assert.equal(payload.result.structuredContent.state, "complete");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("NVIDIA MCP bridge fails closed when configuration is incomplete", async () => {
  const response = await onRequest({
    request: request({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    env: { ...ENV, NEXORA_DEERFLOW_MCP_TOKEN: "" }
  });
  assert.equal(response.status, 503);
});
