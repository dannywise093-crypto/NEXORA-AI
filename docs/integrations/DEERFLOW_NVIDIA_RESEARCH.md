# DeerFlow reference integration for NEXORA NVIDIA Deep Research

## What is included

This branch pins the upstream ByteDance DeerFlow repository as a Git submodule at:

- Path: `third_party/deer-flow`
- Upstream: https://github.com/bytedance/deer-flow
- Pinned revision: `1dafd8a3b45fbb9b98ca13ab3291c8f432bc81ed`
- License at the pinned revision: MIT (retain the upstream LICENSE and copyright notices).

This is an exact source reference, not a runtime merge. It lets developers inspect the full upstream source at the selected revision without copying thousands of files into NEXORA's own source tree or silently mixing DeerFlow dependencies into NVIDIA's Python environment.

## Clone / initialize the source

A normal clone of NEXORA creates the submodule entry but does not populate it. Run:

```bash
git clone https://github.com/dannywise093-crypto/NEXORA-AI.git
cd NEXORA-AI
git submodule update --init --recursive
```

If NEXORA is already cloned:

```bash
git submodule sync --recursive
git submodule update --init --recursive
```

To inspect the exact pinned revision:

```bash
git -C third_party/deer-flow rev-parse HEAD
```

It should print `1dafd8a3b45fbb9b98ca13ab3291c8f432bc81ed`.

## What to study in DeerFlow

Start with the upstream README and architecture documentation, then inspect these areas in the pinned checkout (paths may evolve between upstream revisions):

1. Backend application and gateway: API lifecycle, request validation, streaming and thread handling.
2. Harness / agent construction: lead-agent creation, subagent registration, model selection and tool binding.
3. Middleware: context management, limits, summarization, permissions and tool-call policies.
4. Skills: skill discovery, loading, prompt injection boundaries and filesystem permissions.
5. Memory and state: thread-scoped state, persistent stores, checkpointing and retrieval.
6. Sandbox: execution isolation, filesystem boundaries, resource limits and cleanup.
7. Tools and integrations: web research, file operations, MCP and external service adapters.
8. Frontend: research task submission, progress streaming, thread history and artifact presentation.
9. Deployment: Docker, environment configuration, secrets, database and observability.

Useful upstream entry points:

- Repository: https://github.com/bytedance/deer-flow/tree/1dafd8a3b45fbb9b98ca13ab3291c8f432bc81ed
- README: https://github.com/bytedance/deer-flow/blob/1dafd8a3b45fbb9b98ca13ab3291c8f432bc81ed/README.md
- License: https://github.com/bytedance/deer-flow/blob/1dafd8a3b45fbb9b98ca13ab3291c8f432bc81ed/LICENSE

## NEXORA integration plan

NEXORA already has a separate NVIDIA Deep Research backend and a 200-role specialist catalogue. Keep those as the research engine and specialist source of truth. Evaluate DeerFlow capabilities as reusable design patterns or carefully isolated adapters:

| DeerFlow concept | NEXORA target |
|---|---|
| Lead agent / delegation | NEXORA research orchestrator and 200-role selector |
| Subagents | Existing NVIDIA Deep Research specialist agents |
| Skills | Curated NEXORA research skills, with explicit permissions |
| Memory / threads | Durable research sessions, user/workspace isolation |
| Middleware | Bounded model/tool calls, policy checks, source verification |
| Sandbox | Isolated execution service; never execute untrusted code in the web Worker |
| Streaming | Existing authenticated Pages-to-backend research stream |
| Artifacts | NEXORA report and downloadable research artifact pipeline |

## Important compatibility and security rules

- Do not replace the NVIDIA Deep Research workflows or overwrite its existing agent factory.
- Do not add DeerFlow's entire dependency set to the NEXORA frontend or Cloudflare Worker.
- Do not assume DeerFlow's model provider, database schema, environment variables, sandbox or deployment settings are interchangeable with NVIDIA's.
- Review each imported component and its license before copying or adapting code. Preserve notices and document provenance.
- Keep API keys and service tokens in server-side secret stores; never commit them.
- Require authentication, per-user/thread authorization, rate limits, execution budgets and durable job ownership before production exposure.
- Run tests and a real end-to-end research evaluation before enabling any new orchestration path.

## Current status

This change adds a pinned, inspectable upstream source reference and this integration guide only. It does **not** claim that DeerFlow has been merged into the NVIDIA runtime, that the backend is deployed, or that the combined system is production-ready.


## First runtime capability adopted

The NVIDIA orchestrator now uses a small NEXORA-owned middleware inspired by
DeerFlow's subagent-limit middleware. It enforces both a per-response parallel
limit (10 task calls) and a per-run total (13 task calls). The run total reserves
capacity for source routing, planning, and writer publication while preserving
the existing prompt policy of normally selecting 2–6 specialists and at most 10
for genuinely broad work. Excess calls are removed before dispatch; the
orchestrator receives a bounded note and can continue with the results already
collected. The counter is derived from the current run's message history, so it
does not create a second job store or alter NVIDIA's async job persistence.

Other high-value DeerFlow concepts are already represented in the NVIDIA
backend: native specialist subagents, skills middleware, sandbox isolation,
artifact harvesting, async job events, report follow-up, MCP sources, and
resource limits. Avoid adding duplicate frameworks for those capabilities.
Long-term user/project memory is a separate follow-up because it needs explicit
owner/thread scoping, retention controls, and encrypted persistence; it must not
be implemented by sharing an in-memory store across users or jobs.
