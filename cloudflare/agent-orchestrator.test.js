import test from "node:test";
import assert from "node:assert/strict";
import { runNexoraAgentTeam } from "./agent-orchestrator.js";

test("Chief Agent plans specialist tasks, runs them concurrently, and writes one answer", async () => {
  const calls = [];
  const env = {
    AI: {
      async run(_model, input) {
        const prompt = input.messages.at(-1).content;
        calls.push(prompt);
        if (prompt.includes("Return JSON only")) {
          return { response: JSON.stringify({ tasks: [
            { id: "design", focus: "Design review", question: "Review architecture" },
            { id: "security", focus: "Security review", question: "Review risks" }
          ] }) };
        }
        if (prompt.includes("Specialist findings:")) return { response: "Combined final report." };
        return { response: "Specialist findings." };
      }
    }
  };
  const result = await runNexoraAgentTeam({ prompt: "Design a secure research platform", evidence: "Source A", env });
  assert.equal(result.answer, "Combined final report.");
  assert.equal(result.orchestration, "completed");
  assert.equal(result.plan.length, 2);
  assert.equal(result.agents.length, 2);
  assert.equal(calls.length, 4);
});

test("Chief Agent uses bounded default workstreams when planner output is invalid", async () => {
  const env = { AI: { async run() { return { response: "not JSON; specialist output" }; } } };
  const result = await runNexoraAgentTeam({ prompt: "Explain a system design", env });
  assert.equal(result.plan.length, 3);
  assert.equal(result.agents.length, 3);
});
