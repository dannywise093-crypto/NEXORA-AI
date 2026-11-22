// ATLAS model gateway client.
// Production requests use same-origin Cloudflare Pages Functions.
// Gateway and NVIDIA credentials remain server-side and never enter VITE_*.
const API_BASE = String(import.meta.env.VITE_ATLAS_API_URL || "").replace(/\/$/, "");

export function getNeuralRuntimeStatus() {
  return {
    id: "atlas-cloudflare-workers-ai",
    label: "ATLAS hosted inference · NVIDIA + Cloudflare Workers AI",
    available: false,
    reason: "Checking the secured ATLAS inference gateway.",
  };
}

async function requestJson(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { Accept: "application/json", ...(options.headers || {}) },
    });
  } catch {
    throw new Error("The ATLAS application server could not be reached. Check the deployment and try again.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : typeof payload.detail === "string"
          ? payload.detail
          : `ATLAS service returned HTTP ${response.status}.`
    );
  }
  return payload;
}

export async function checkAtlasBackend(signal) {
  return requestJson("/api/health", { signal });
}

function appendSkillUsageNotice(answer) {
  // Skill routing is internal implementation detail; expose it only when the user asks.
  return answer;
}

export async function generateAtlasResponse(history, signal, options = {}) {
  const messages = history
    .filter((item) => item && (item.role === "user" || item.role === "atlas" || item.role === "assistant"))
    .slice(-24)
    .map((item) => ({
      role: item.role === "atlas" ? "assistant" : item.role,
      content: String(item.text || "").trim().slice(0, 12000),
    }))
    .filter((item) => item.content.length > 0);

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    throw new Error("Send a message before requesting an ATLAS response.");
  }

  const payload = await requestJson("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, voiceMode: options.voiceMode === true, researchMode: options.researchMode === true, agentMode: options.agentMode === true }),
    signal,
  });
  if (typeof payload.answer !== "string" || !payload.answer.trim()) {
    throw new Error("The configured model returned an empty response.");
  }
  return {
    answer: appendSkillUsageNotice(payload.answer.trim(), payload),
    sources: Array.isArray(payload.research?.sources) ? payload.research.sources : [],
    research: payload.research || null,
  };
}

async function generateNexoraAgentResponse(history, signal) {
  const messages = history
    .filter(item => item && (item.role === "user" || item.role === "atlas" || item.role === "assistant"))
    .slice(-24)
    .map(item => ({
      role: item.role === "atlas" ? "assistant" : item.role,
      content: String(item.text || "").trim().slice(0, 12000)
    }))
    .filter(item => item.content.length > 0);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    throw new Error("Send a task before starting the NEXORA Chief Agent.");
  }
  const payload = await requestJson("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, agentMode: true, researchMode: true }),
    signal
  });
  if (typeof payload.answer !== "string" || !payload.answer.trim()) {
    throw new Error("NEXORA Agent System returned an empty report.");
  }
  return {
    answer: payload.answer.trim(),
    agentRun: {
      plan: Array.isArray(payload.plan) ? payload.plan : [],
      agents: Array.isArray(payload.agents) ? payload.agents : [],
      progress: Array.isArray(payload.progress) ? payload.progress : [],
      reviewer: payload.reviewer || null,
      sourceAudit: payload.sourceAudit || null,
      reportComplete: payload.reportComplete !== false,
      orchestration: payload.orchestration || "unknown",
      provider: payload.provider || "configured gateway",
      sources: Array.isArray(payload.research?.sources) ? payload.research.sources : [],
      research: payload.research || null
    }
  };
}

const CODING_RESEARCH_TRIGGER = /\b(research|verify against (?:the )?official docs|check (?:the )?current docs|latest version|current version|version compatibility|security audit|dependency audit)\b/i;
const CODING_TECH_TERMS = /\b(api|sdk|library|libraries|framework|package|dependency|dependencies|cloudflare|react|vite|node(?:\.js)?|python|typescript|javascript|rust|go|docker|kubernetes|database|oauth|webhook|protocol|cuda|nvidia)\b/i;
const CODING_COMPLEX_TASK = /\b(build|implement|integrate|migrate|upgrade|debug|fix|review|architect|deploy|optimi[sz]e|secure|compare|configure)\b/i;

function shouldResearchCopilotPrompt(prompt) {
  const value = String(prompt || "");
  return CODING_RESEARCH_TRIGGER.test(value) ||
    (CODING_TECH_TERMS.test(value) && CODING_COMPLEX_TASK.test(value) && value.length >= 100);
}

function waitForResearchPoll(signal, milliseconds) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("The operation was aborted.", "AbortError"));
    const timer = setTimeout(done, milliseconds);
    function done() {
      signal?.removeEventListener("abort", abort);
      resolve();
    }
    function abort() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    }
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function sourceRecords(reportText, state) {
  const stateSources = state?.artifacts?.sources || {};
  const urls = [
    ...(Array.isArray(stateSources.cited_urls) ? stateSources.cited_urls : []),
    ...(Array.isArray(stateSources.found_urls) ? stateSources.found_urls : []),
    ...(String(reportText).match(/https?:\/\/[^\s)\]>]+/g) || []),
  ];
  const unique = [...new Set(urls)].slice(0, 20);
  return unique.flatMap((value) => {
    try {
      const parsed = new URL(value);
      if (!["http:", "https:"].includes(parsed.protocol)) return [];
      return [{ title: parsed.hostname, url: parsed.href, provider: "NVIDIA Deep Researcher" }];
    } catch {
      return [];
    }
  });
}

async function runCopilotDeepResearch(prompt, signal) {
  try {
    const catalog = await requestJson("/api/research/agents", { signal });
    const agents = Array.isArray(catalog.agents) ? catalog.agents : [];
    if (!agents.some((agent) => agent.agent_type === "deep_researcher")) {
      return { status: "unavailable", context: "", sources: [], jobId: null };
    }

    const submitted = await requestJson("/api/research/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_type: "deep_researcher",
        input: [
          "Prepare a coding-focused technical research brief for NEXORA Copilot.",
          "Investigate current official documentation, supported API signatures, version compatibility, security guidance, and authoritative implementation examples.",
          "Prioritize official vendor documentation and primary repositories. Separate confirmed facts from assumptions and include source URLs.",
          "Do not execute code or claim that a test was run. Return concise findings useful for implementing the user's request.",
          "User request: " + prompt,
        ].join("\n\n"),
      }),
      signal,
    });
    const jobId = typeof submitted.job_id === "string" ? submitted.job_id : "";
    if (!jobId) return { status: "unavailable", context: "", sources: [], jobId: null };

    const deadline = Date.now() + 100_000;
    let completed = false;
    while (Date.now() < deadline) {
      const statusData = await requestJson("/api/research/job/" + encodeURIComponent(jobId), { signal });
      const status = String(statusData.status || statusData.job?.status || statusData.job_info?.status || "").toLowerCase();
      if (["success", "completed", "complete"].includes(status)) {
        completed = true;
        break;
      }
      if (["failure", "failed", "error", "cancelled", "interrupted"].includes(status)) {
        return { status: "failed", context: "", sources: [], jobId };
      }
      await waitForResearchPoll(signal, 2000);
    }
    if (!completed) return { status: "pending", context: "", sources: [], jobId };

    const report = await requestJson("/api/research/job/" + encodeURIComponent(jobId) + "/report", { signal });
    const reportText = String(report.report || report.markdown || report.content || "").trim();
    if (!reportText) return { status: "empty_report", context: "", sources: [], jobId };
    let state = null;
    try {
      state = await requestJson("/api/research/job/" + encodeURIComponent(jobId) + "/state", { signal });
    } catch {
      // The report remains useful even if event-derived citation metadata is unavailable.
    }
    return {
      status: "completed",
      context: reportText.slice(0, 28000),
      sources: sourceRecords(reportText, state),
      jobId,
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { status: "unavailable", context: "", sources: [], jobId: null };
  }
}

export async function generateAtlasCopilotResponse(history, signal) {
  const messages = history
    .filter((item) => item && (item.role === "user" || item.role === "atlas" || item.role === "assistant"))
    .slice(-24)
    .map((item) => ({
      role: item.role === "atlas" ? "assistant" : item.role,
      content: String(item.text || "").trim().slice(0, 12000),
    }))
    .filter((item) => item.content.length > 0);

  if (!messages.length || messages[messages.length - 1].role !== "user") {
    throw new Error("Send a coding question before requesting NEXORA Copilot.");
  }

  const latestPrompt = messages[messages.length - 1].content;
  const research = shouldResearchCopilotPrompt(latestPrompt)
    ? await runCopilotDeepResearch(latestPrompt, signal)
    : { status: "not_needed", context: "", sources: [], jobId: null };

  const payload = await requestJson("/api/copilot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      researchContext: research.context,
      researchStatus: research.status,
      researchSources: research.sources,
    }),
    signal,
  });
  if (typeof payload.answer !== "string" || !payload.answer.trim()) {
    throw new Error("NEXORA Copilot returned an empty response.");
  }
  return {
    answer: appendSkillUsageNotice(payload.answer.trim(), payload),
    sources: research.sources,
    research: { status: research.status, jobId: research.jobId },
  };
}
export async function generateProviderResponse(provider, history, signal, options = {}) {
  if (provider === "atlas") return generateAtlasResponse(history, signal, options);
  if (provider === "deep_research") return generateAtlasResponse(history, signal, { ...options, researchMode: true });
  if (provider === "chief_agent") return generateNexoraAgentResponse(history, signal);
  if (provider !== "nvidia") throw new Error("This provider adapter is not available in this NEXORA build.");
  const messages = history
    .filter((item) => item && (item.role === "user" || item.role === "atlas" || item.role === "assistant"))
    .slice(-24)
    .map((item) => ({ role: item.role === "atlas" ? "assistant" : item.role, content: String(item.text || "").trim().slice(0, 12000) }))
    .filter((item) => item.content.length > 0);
  if (!messages.length || messages[messages.length - 1].role !== "user") throw new Error("Send a message before requesting a response.");
  const payload = await requestJson("/api/nvidia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages, voiceMode: options.voiceMode === true }), signal });
  if (typeof payload.answer !== "string" || !payload.answer.trim()) throw new Error("NVIDIA returned an empty response.");
  return appendSkillUsageNotice(payload.answer.trim(), payload);
}
