# NEXORA × NVIDIA Deep Research × DeerFlow

## What is connected

NEXORA's existing NVIDIA Deep Research backend remains the research engine. Its
deep_researcher workflow registers 200 NEXORA specialist profiles as native
on-demand DeepAgents subagents. They are delegated to selectively by the lead
research orchestrator; they are not 200 separate hosted API services.

DeerFlow is the outer agent harness. It connects to the NVIDIA workflow through
the Model Context Protocol (MCP), using DeerFlow's supported Streamable HTTP
MCP client. The Cloudflare Pages Function at /mcp/nvidia is the bridge, so no
second Python research runtime or paid Cloudflare Containers plan is needed.

~~~text
DeerFlow lead agent
  └── nvidia-deep-research MCP tools
        └── NEXORA Cloudflare Pages /mcp/nvidia
              └── authenticated existing NVIDIA Deep Research API
                    └── deep_researcher workflow
                          └── 200 on-demand NEXORA specialist subagents
~~~

## Cloudflare Pages secrets

Set these as server-side Pages secrets/variables. Do not use VITE_ variables
and do not commit their values.

- DEEP_RESEARCHER_URL: HTTPS origin of the existing NVIDIA Deep Research API.
- NEXORA_RESEARCH_API_TOKEN: the existing backend service token (at least 32 characters).
- NEXORA_DEERFLOW_MCP_TOKEN: a separate random service token (at least 32 characters) used only by DeerFlow to access /mcp/nvidia.

The MCP bridge rejects requests without the separate DeerFlow bearer token. It
then uses NEXORA_RESEARCH_API_TOKEN server-side to call the existing NVIDIA
API. The browser never receives either credential.

The bridge uses the existing API contract:
- GET /v1/jobs/async/agents
- POST /v1/jobs/async/submit
- GET /v1/jobs/async/job/{job_id}
- GET /v1/jobs/async/job/{job_id}/report

The submit operation always selects agent_type: deep_researcher; this routes
the request through the actual NVIDIA Deep Research workflow and its
specialist registry.

## DeerFlow configuration

Copy
integrations/deerflow/extensions_config.nexora.example.json to
extensions_config.json in the root of the DeerFlow checkout. In the
DeerFlow backend environment set:

- NEXORA_NVIDIA_MCP_URL=https://YOUR_NEXORA_DOMAIN/mcp/nvidia
- NEXORA_NVIDIA_MCP_AUTHORIZATION=Bearer YOUR_NEXORA_DEERFLOW_MCP_TOKEN

The value of NEXORA_NVIDIA_MCP_AUTHORIZATION must be the word Bearer, one
space, then the exact token stored in Cloudflare as
NEXORA_DEERFLOW_MCP_TOKEN. Keep the token in the server's secret manager.
Then change enabled: false to enabled: true in the local
extensions_config.json and restart DeerFlow or reset its MCP tools cache.
DeerFlow prefixes the tools with nvidia-deep-research_.

After startup, DeerFlow should discover these tools:
- nvidia-deep-research_list_research_agents
- nvidia-deep-research_submit_query
- nvidia-deep-research_poll_query
- nvidia-deep-research_get_final_report

The expected interaction is: list available workflows, submit a query, wait
for the returned polling interval, poll until complete, then retrieve the
report. The NVIDIA MCP bridge returns structured JSON tool results as well as
text content.

## Security and limits

- The MCP bridge requires a dedicated bearer token and does not expose the
  NVIDIA backend token to DeerFlow.
- Use HTTPS for the public Cloudflare URL.
- The bearer token is a shared service credential, not per-user identity.
  NVIDIA job IDs are opaque capabilities; keep them private and avoid placing
  them in logs or user-visible links.
- The Cloudflare endpoint does not run arbitrary code or a second model. It
  only translates MCP calls into the existing authenticated NVIDIA research
  API contract.
- The 200 specialists are invoked by NVIDIA's orchestrator as needed. They
  should not all be launched for every question.

## Verification

Run the repository test suite with npm test. The MCP bridge tests verify
authentication, tool discovery, job submission mapping, status normalization,
and fail-closed configuration. A successful local unit test does not prove
that Cloudflare secrets are set, that the Pages deployment has published the
route, or that the remote NVIDIA API is reachable. Confirm those with an
authenticated MCP initialize/tools-list call and one small end-to-end research
job from the DeerFlow client.
