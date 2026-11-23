# DeerFlow ↔ NEXORA Cloudflare Research MCP

## What this integration connects

The `/mcp/nexora` Cloudflare Pages Function exposes one authenticated MCP tool,
`run_nexora_research`. It calls the existing `atlas-model-gateway` Worker at
`/api/chat` with `researchMode: true` and `agentMode: true`, then returns the
gateway's answer, agent execution metadata, and source metadata.

This reuses the currently deployed NEXORA Cloudflare research workflow. The
gateway source confirms that research mode performs provider-backed research
and invokes NEXORA's multi-agent orchestration path when available.

**Important boundary:** this is not the separate NVIDIA Deep Researcher Python
job API. It does not claim to run the 200 specialist subagents in
`agents/nvidia-deep-researcher`. Those specialists are registered in the
Python project's source, but they are live only when that Python backend is
actually deployed and configured. A Cloudflare Worker cannot host that Python
runtime merely by adding the repository folder.

## Cloudflare Pages secrets

In the `nexora-ai` Pages project, add this encrypted secret to both Production
and Preview:

- `NEXORA_DEERFLOW_MCP_TOKEN`: a dedicated random bearer token of at least 32
  characters. Do not reuse the public website URL or commit this value.

The existing `ATLAS_GATEWAY_TOKEN` Pages secret is used server-to-server by
the bridge to authenticate to the already deployed `atlas-model-gateway`
Worker. The bridge does not read or expose the secret to DeerFlow.

The bridge endpoint is:

`https://nexora-ai-9i7.pages.dev/mcp/nexora`

## DeerFlow configuration

Copy `extensions_config.nexora.example.json` into the DeerFlow configuration
location described by the pinned DeerFlow version. Set these environment
variables in the DeerFlow runtime:

- `NEXORA_NEXORA_MCP_URL=https://nexora-ai-9i7.pages.dev/mcp/nexora`
- `NEXORA_NEXORA_MCP_AUTHORIZATION=Bearer <the same dedicated MCP token>`

Keep the MCP server disabled until the token is set in both places. Enable it
after deployment and verify that DeerFlow discovers the
`run_nexora_research` tool.

## Verification

1. Run `npm test`; the NEXORA MCP adapter tests are included.
2. Deploy the Pages project from the merged branch.
3. Confirm an unauthenticated POST receives HTTP 401 after the MCP secret is
   configured.
4. Configure DeerFlow with the endpoint and bearer token.
5. Run a low-risk factual research question and confirm that the MCP result
   contains an answer and source metadata.

## Full NVIDIA Deep Researcher backend

The separate NVIDIA service still requires its Python API runtime, durable job
store, and its own `NEXORA_RESEARCH_API_TOKEN`. Its deployment guide is
`agents/nvidia-deep-researcher/NEXORA-DEPLOYMENT.md`. The existing
`/mcp/nvidia` bridge remains available for that backend when a real HTTPS
backend URL and matching secrets are configured. Do not set
`DEEP_RESEARCHER_URL` to the Pages website or to the general AI gateway: their
routes are not the NVIDIA async job API.

Cloudflare Workers Free has request and CPU limits; long research calls must be
tested against the actual workflow and may need to be shortened or split. See
the official [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
and [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/).
