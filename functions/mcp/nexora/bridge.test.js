import test from "node:test";
import assert from "node:assert/strict";
import { onRequest } from "./[[path]].js";

const MCP_TOKEN = "nexora-mcp-test-token-012345678901234567890123456789";
const GATEWAY_TOKEN = "nexora-gateway-test-token-012345678901234567890123456789";
const ENV = {
  NEXORA_DEERFLOW_MCP_TOKEN: MCP_TOKEN,
  ATLAS_GATEWAY_TOKEN: GATEWAY_TOKEN
};

function request(body, authorization = "Bearer " + MCP_TOKEN) {
  return new Request("https://nexora.example/mcp/nexora", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {})
    },
    body: JSON.stringify(body)
  });
}

test("NEXORA MCP bridge requires a separate client token", async () => {
  const response = await onRequest({
    request: request({ jsonrpc: "2.0", id: 1, method: "initialize" }, ""),
    env: ENV
  });
  assert.equal(response.status, 401);
});

test("NEXORA MCP bridge lists the live gateway research tool", async () => {
  const response = await onRequest({
    request: request({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    env: ENV
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(payload.result.tools.map(tool => tool.name), ["run_nexora_research"]);
  assert.match(payload.result.tools[0].description, /not the separate NVIDIA Deep Researcher Python job service/);
});

test("NEXORA MCP bridge forwards a research request to the existing Cloudflare gateway", async () => {
  const originalFetch = globalThis.fetch;
  let calledUrl = "";
  let calledBody;
  globalThis.fetch = async (url, options) => {
    calledUrl = String(url);
    calledBody = JSON.parse(options.body);
    assert.equal(options.headers.Authorization, "Bearer " + GATEWAY_TOKEN);
    return new Response(JSON.stringify({
      answer: "Research result",
      provider: "NVIDIA API Catalog",
      model: "test-model",
      agents: [{ id: "planner", status: "completed" }],
      research: { status: "completed", sources: [{ title: "Source", url: "https://example.com" }] },
      reportComplete: true
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const response = await onRequest({
      request: request({
        jsonrpc: "2.0",
        id: 9,
        method: "tools/call",
        params: { name: "run_nexora_research", arguments: { query: "Investigate this topic" } }
      }),
      env: ENV
    });
    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(calledUrl, "https://atlas-model-gateway.dannywise093.workers.dev/api/chat");
    assert.deepEqual(calledBody, {
      messages: [{ role: "user", content: "Investigate this topic" }],
      researchMode: true,
      agentMode: true
    });
    assert.equal(payload.result.isError, false);
    assert.equal(payload.result.structuredContent.answer, "Research result");
    assert.equal(payload.result.structuredContent.sources[0].url, "https://example.com");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("NEXORA MCP bridge fails closed when either secret is missing", async () => {
  const response = await onRequest({
    request: request({ jsonrpc: "2.0", id: 1, method: "initialize" }),
    env: { ...ENV, ATLAS_GATEWAY_TOKEN: "" }
  });
  assert.equal(response.status, 503);
});
