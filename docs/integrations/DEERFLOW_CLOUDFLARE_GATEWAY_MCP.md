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

The NEXORA example file
`integrations/deerflow/extensions_config.nexora.example.json` now includes
both NEXORA MCP routes:

- `nexora-cloudflare-research` → `https://nexora-ai-9i7.pages.dev/mcp/nexora`
  (the currently deployed Atlas research workflow).
- `nexora-nvidia-deep-research` → `https://nexora-ai-9i7.pages.dev/mcp/nvidia`
  (the separate NVIDIA async-job backend; it remains unavailable until that
  backend is actually deployed and `DEEP_RESEARCHER_URL` is configured).

Copy the example file to `extensions_config.json` in the root of the DeerFlow
checkout. In the DeerFlow backend environment set:

- `NEXORA_NEXORA_MCP_URL=https://nexora-ai-9i7.pages.dev/mcp/nexora`
- `NEXORA_NEXORA_MCP_AUTHORIZATION=Bearer <the same dedicated MCP token>`
- `NEXORA_NVIDIA_MCP_URL=https://nexora-ai-9i7.pages.dev/mcp/nvidia`
- `NEXORA_NVIDIA_MCP_AUTHORIZATION=Bearer <the same dedicated MCP token>`

Keep both entries disabled until the matching endpoint is ready. The Atlas
entry can be enabled once its Cloudflare secret is configured and a real
DeerFlow runtime is available. Keep the NVIDIA entry disabled until a genuine
NVIDIA backend is running and its Cloudflare Pages variables
`DEEP_RESEARCHER_URL` and `NEXORA_RESEARCH_API_TOKEN` are configured. Do not
point `DEEP_RESEARCHER_URL` at the Pages website or the general AI gateway.

DeerFlow prefixes discovered tool names with each server name by default. The
Atlas route should expose `nexora-cloudflare-research_run_nexora_research`.
The NVIDIA route should expose the four tools
`nexora-nvidia-deep-research_list_research_agents`,
`nexora-nvidia-deep-research_submit_query`,
`nexora-nvidia-deep-research_poll_query`, and
`nexora-nvidia-deep-research_get_final_report`.

## Verification

1. Run `npm test`; the NEXORA MCP adapter tests are included.
2. Deploy the Pages project from the merged branch.
3. Confirm an unauthenticated POST receives HTTP 401 after the MCP secret is
   configured.
4. Start the official DeerFlow runtime, load the copied extensions config, and
   verify that it discovers the Atlas research tool.
5. Run a low-risk factual research question and confirm that the MCP result
   contains an answer and source metadata.
6. Verify the NVIDIA route separately only after its backend is deployed; list
   agents, submit a small job, poll it, and retrieve the final report.

## Full NVIDIA Deep Researcher backend

The separate NVIDIA service still requires its Python API runtime, durable job
store, and its own `NEXORA_RESEARCH_API_TOKEN`. Its deployment guide is
`agents/nvidia-deep-researcher/NEXORA-DEPLOYMENT.md`. The existing
`/mcp/nvidia` bridge remains available for that backend when a real HTTPS
backend URL and matching secrets are configured.

Cloudflare Workers Free has request and CPU limits; long research calls must be
tested against the actual workflow and may need to be shortened or split. See
the official [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
and [Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/).
