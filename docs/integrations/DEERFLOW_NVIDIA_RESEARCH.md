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



## Capability adoption: preserve NVIDIA, adopt selectively

The NVIDIA runtime already implements much of the capability set that makes DeerFlow useful. Do not build a second agent runtime beside it.

### Already implemented in the NVIDIA research engine

- A lead orchestrator with staged source routing, planning, research, specialist review, and writer-owned synthesis.
- A 200-role on-demand specialist catalogue registered as native DeepAgents subagents.
- Bounded parallel researcher workers, per-job model/tool/resource limits, retry middleware, and explicit failure handling.
- Read-only, assigned skill collections; optional job-scoped Modal/OpenShell sandbox providers; artifact harvesting.
- Source registries, source allowlists, citation verification, and final-report commit verification.
- Durable asynchronous jobs, owner/conversation access checks, event persistence, streaming, cancellation, and authorized parent-report follow-up.

### Initial DeerFlow-inspired adoption

The research orchestrator now maintains a compact /shared/research_continuity.json checkpoint ledger across resumptions of the same graph run. It records phase progress, successfully completed queries, specialist outcomes, and unresolved gaps. It is deliberately treated as advisory: the orchestrator must verify the underlying plan, note, and artifact files before skipping work.

Cross-run context remains owner-authorized and uses the existing parent-report follow-up path. The continuity ledger is not a new global memory store and must never contain secrets or private document contents.

### Capabilities intentionally not imported

- DeerFlow's full Gateway, frontend, database schema, model registry, and dependency graph.
- Its general-purpose channel integrations and scheduler, which are outside the NVIDIA research service's current contract.
- A second memory backend. NEXORA should extend its existing knowledge/job storage rather than introduce an unscoped parallel memory system.
- Interactive approval flows for tools that the research agent does not currently need. If write-capable or external-action tools are added later, add authenticated, server-enforced approval gates before exposing them to agents.

### Validation boundary

This adoption changes orchestrator instructions only. It does not add a new database migration, alter NVIDIA model/provider configuration, enable sandbox execution, change Cloudflare routing, or prove a production deployment. Run the NVIDIA package's focused prompt/agent tests and an authenticated end-to-end research job before enabling the revised workflow in production.

## Current status

The pinned DeerFlow source reference is merged into NEXORA main. The first selective adoption adds a checkpoint-continuity protocol to the existing NVIDIA orchestrator and documents the capability mapping above. This is not a full DeerFlow runtime import and does not claim a production deployment.


## Enforced subagent delegation limits

The NVIDIA research orchestrator now installs a NEXORA-owned
`SubagentDelegationLimitMiddleware`, inspired by DeerFlow's bounded subagent
delegation pattern. The middleware enforces two limits before task dispatch:

- At most 10 `task()` calls in one model response.
- At most 13 `task()` calls across one research run.

The total budget reserves capacity for source routing, planning, up to 10
specialist assessments, and writer publication. Existing prompt guidance still
prefers 2–6 specialists and allows up to 10 only for genuinely broad work.
Non-task tool calls are preserved. Excess task calls are withheld before
execution and the orchestrator receives a bounded note so it can continue with
the available results.

The limit is enforced from the current run's message history; it does not add a
second job store, change the NVIDIA workflow engine, or create cross-user memory.
Focused tests cover parallel and total limits, preservation of non-task calls,
invalid configuration, and the async middleware hook.

This is a code-level adoption of one DeerFlow guardrail, not a wholesale DeerFlow
runtime import. The NVIDIA backend remains the sole research engine.
