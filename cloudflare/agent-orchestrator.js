const FALLBACK_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_TASKS = 3;

function cleanText(value, max = 7000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parsePlan(text, prompt) {
  try {
    const candidate = text.match(/\{[\s\S]*\}/)?.[0];
    const parsed = JSON.parse(candidate || "{}");
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const safe = tasks.slice(0, MAX_TASKS).map((task, index) => ({
      id: cleanText(task.id, 40) || `specialist-${index + 1}`,
      focus: cleanText(task.focus, 100) || ["Technical analysis", "Evidence review", "Risks and implementation"][index],
      question: cleanText(task.question, 500) || prompt
    }));
    if (safe.length) return safe;
  } catch {}
  return [
    { id: "technical", focus: "Technical analysis", question: prompt },
    { id: "evidence", focus: "Evidence and assumptions", question: prompt },
    { id: "risks", focus: "Risks and practical implementation", question: prompt }
  ];
}

async function callModel(env, system, prompt) {
  const messages = [{ role: "system", content: system }, { role: "user", content: prompt }];
  const keys = [env.NVIDIA_API_KEY, env.NVIDIA_API_KEY_2].filter(Boolean);
  for (const key of keys) {
    try {
      const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "nvidia/nemotron-3-ultra-550b-a55b",
          messages,
          temperature: 0.25,
          max_tokens: 1800,
          stream: false
        }),
        signal: AbortSignal.timeout(65000)
      });
      if (!response.ok) continue;
      const data = await response.json().catch(() => ({}));
      const answer = cleanText(data?.choices?.[0]?.message?.content, 12000);
      if (answer) return { answer, provider: "NVIDIA API Catalog" };
    } catch {}
  }
  if (env.AI?.run) {
    try {
      const result = await env.AI.run(FALLBACK_MODEL, {
        messages,
        max_tokens: 1800,
        temperature: 0.25
      });
      const answer = cleanText(result?.response || result?.choices?.[0]?.message?.content, 12000);
      if (answer) return { answer, provider: "Cloudflare Workers AI" };
    } catch {}
  }
  throw new Error("No configured NEXORA inference provider completed an agent task.");
}

/**
 * A bounded, supervised multi-agent workflow. Agents share the same evidence
 * packet; they do not get arbitrary tools or permission to perform external
 * actions. Research sources are supplied by the existing provider aggregator.
 */
export async function runNexoraAgentTeam({ prompt, evidence = "", env, mode = "chief" }) {
  const task = cleanText(prompt, 12000);
  if (!task) throw new Error("A non-empty task is required.");
  const planResult = await callModel(
    env,
    "You are the NEXORA Chief Agent planner. Break the user task into at most three independent specialist workstreams. Return only valid JSON with a tasks array. Each task has id, focus, and question. Do not claim tools were used. Keep questions focused and complementary.",
    `Task: ${task}\n\nAvailable evidence:\n${cleanText(evidence, 14000) || "No external evidence supplied."}\n\nReturn JSON only.`
  );
  const plan = parsePlan(planResult.answer, task);
  const specialistResults = await Promise.all(plan.map(async (item) => {
    const result = await callModel(
      env,
      `You are a NEXORA specialist agent focused on ${item.focus}. Analyze only your assigned workstream. Separate supported facts, assumptions, uncertainties, and recommendations. Do not invent sources or claim actions you did not perform.`,
      `User task: ${task}\n\nYour workstream: ${item.question}\n\nShared evidence packet:\n${cleanText(evidence, 14000) || "No external evidence supplied."}`
    );
    return { id: item.id, focus: item.focus, provider: result.provider, findings: result.answer };
  }));
  const writerResult = await callModel(
    env,
    "You are the NEXORA Writer Agent. Combine specialist findings into one clear, useful answer. Resolve contradictions explicitly, distinguish evidence from assumptions, preserve source URLs when present, and state limitations. Never claim independent verification beyond the supplied evidence.",
    `Mode: ${mode}\nUser task: ${task}\n\nSpecialist findings:\n${specialistResults.map((item) => `## ${item.focus}\n${item.findings}`).join("\n\n")}\n\nWrite the final response.`
  );
  return {
    answer: writerResult.answer,
    provider: writerResult.provider,
    plan: plan.map(({ id, focus }) => ({ id, focus })),
    agents: specialistResults.map(({ id, focus, provider }) => ({ id, focus, provider, status: "completed" })),
    orchestration: "completed"
  };
}
