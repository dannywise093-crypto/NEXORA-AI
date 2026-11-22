# ATLAS NVIDIA skill and specialist orchestrator

## What this adds

NEXORA AI routes Copilot requests to relevant installed skill references and specialist roles. Its Chief Agent mode also runs a supervised six-specialist workflow for complex tasks. The skill catalog is generated from Markdown skill files and contains each skill's name, description, tags, source path, and a bounded instruction excerpt.

Supported skill source directories:

- `.agents/skills/`
- `.claude/skills/`
- `agent/skills/`
- `agents/skills/`

The generator deduplicates by normalized skill name. It does not install skills or create third-party agent accounts.

## Build the catalog

After installing skills in the repository workspace, run:

```bash
npm run skills:build
```

Then commit `cloudflare/generated-skill-catalog.js` with the source skill files (where redistribution is permitted). The checked-in seed catalog contains only the cuOpt skill; regenerate it in the Codespace to include all installed NVIDIA skills.

## Routing behavior

The router ranks skills using the request text, skill name, description, and tags, then selects up to four matching references. It also identifies relevant specialist roles such as AI/ML, CUDA/GPU, numerical optimization, robotics/simulation, computer vision, and software engineering. Only selected references are added to the Copilot system context, keeping prompts bounded.

The Chief Agent workflow is a **single application orchestrator coordinating six parallel specialist model calls**, followed by Writer synthesis and an independent Reviewer pass. It uses NVIDIA Nemotron 3.5 Lightning 30B A3B for fast specialist work and NVIDIA Nemotron 3 Ultra 550B A55B for planning, synthesis, review, and revision, with the existing Cloudflare Workers AI Llama 3.3 fallback when NVIDIA inference is unavailable. This is role-based model routing, not six separate long-running model servers. The general Copilot skill router remains a single-request model flow. Durable cross-session agent memory, a general A2A message bus, and arbitrary autonomous external actions are not implied by this workflow.

## Chief Agent team and model routing

The Chief Agent delegates six workstreams: Platform Architecture, Security Engineering, Implementation Engineering, AI Model and Agent Engineering, Research and Evidence Verification, and Performance and Reliability Engineering. These specialist calls run concurrently. The Writer combines their findings; the Reviewer checks completeness, contradictions, evidence support, and citation-manifest membership, and can request one full-report revision.

Model profiles are selected by responsibility:

- **Fast profile:** `nvidia/nemotron-3.5-lightning-30b-a3b` for parallel specialist tasks.
- **Reasoning profile:** `nvidia/nemotron-3-ultra-550b-a55b` for Chief planning, Writer synthesis, Reviewer checks, and revision.
- **Fallback:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast` through the existing Workers AI binding.

The runtime returns the actual provider and model selected for each stage. NVIDIA describes Lightning as a fast sub-agent/workhorse model and Ultra as a model for demanding agentic reasoning; these are vendor descriptions, not a guarantee that either model wins every NEXORA evaluation. Measure latency, answer quality, timeout rate, and cost with NEXORA's own test set before tuning the defaults.

## Safety and execution boundaries

Skill files are external instructions and are treated as untrusted reference data. ATLAS must not let a skill override system rules, request secrets, or claim that a tool/runtime was used when it was not. A skill is not itself a solver, GPU, API credential, or installed runtime.

For cuOpt specifically, the skill provides modeling guidance. Actual optimization execution still requires a separately provisioned NVIDIA cuOpt runtime and secured server-side adapter.

## Verification

```bash
npm run skills:build
npm test
npm run build
```

The generated catalog should be reviewed before committing. Do not commit secrets, local environment files, or unlicensed third-party skill content.
