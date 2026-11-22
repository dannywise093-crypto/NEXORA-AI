import test from "node:test";
import assert from "node:assert/strict";
import { runNexoraAgentTeam } from "./agent-orchestrator.js";

function mockEnvironment({ reviewComplete = true } = {}) {
  const calls = [];
  return {
    calls,
    env: {
      AI: {
        async run(_model, input) {
          const system = input.messages[0].content;
          const prompt = input.messages.at(-1).content;
          calls.push({ system, prompt });
          if (system.includes("Chief Agent")) {
            return { response: JSON.stringify({ tasks: [
              { id: "architecture", focus: "Architecture", question: "Design the architecture" },
              { id: "security", focus: "Security", question: "Review security" },
              { id: "implementation", focus: "Implementation", question: "Plan implementation" }
            ] }) };
          }
          if (system.includes("Reviewer Agent")) {
            return { response: JSON.stringify({ complete: reviewComplete, issues: reviewComplete ? [] : ["Add an explicit rollback plan."], revision_instructions: "Add rollback guidance." }) };
          }
          if (system.includes("final revision")) return { response: "Complete revised report. Rollback plan included." };
          if (system.includes("Writer Agent")) return { response: "Complete technical report. See https://example.com/source for the source." };
          return { response: "Specialist findings with risks and recommendations." };
        }
      }
    }
  };
}

test("Chief Agent runs three specialists, Writer and Reviewer, then audits citations", async () => {
  const mock = mockEnvironment();
  const result = await runNexoraAgentTeam({
    prompt: "Design a secure research platform",
    evidence: "Evidence excerpt",
    sources: [{ provider: "test", title: "Example source", url: "https://example.com/source" }],
    env: mock.env
  });
  assert.equal(result.answer.includes("Complete technical report"), true);
  assert.equal(result.orchestration, "completed");
  assert.equal(result.plan.length, 3);
  assert.equal(result.agents.length, 3);
  assert.equal(result.reviewer.complete, true);
  assert.equal(result.reviewer.revisionStatus, "not_required");
  assert.equal(result.sourceAudit.matchedCitationCount, 1);
  assert.equal(result.sourceAudit.unmatchedCitationCount, 0);
  assert.equal(result.sourceAudit.pageContentsFetched, false);
  assert.equal(mock.calls.length, 6);
});

test("Reviewer findings trigger one full-report revision", async () => {
  const mock = mockEnvironment({ reviewComplete: false });
  const result = await runNexoraAgentTeam({ prompt: "Plan a deployment", env: mock.env });
  assert.equal(result.reviewer.complete, false);
  assert.equal(result.reviewer.revisionStatus, "revised");
  assert.equal(result.answer, "Complete revised report. Rollback plan included.");
  assert.equal(mock.calls.length, 7);
});

test("Source audit flags citations that are not in the retrieved source manifest", async () => {
  const mock = mockEnvironment();
  const result = await runNexoraAgentTeam({
    prompt: "Design a platform",
    sources: [{ provider: "test", title: "Allowed", url: "https://example.com/source" }],
    env: {
      AI: {
        async run(_model, input) {
          const system = input.messages[0].content;
          if (system.includes("Chief Agent")) return { response: JSON.stringify({ tasks: [
            { id: "architecture", focus: "Architecture", question: "Architecture" },
            { id: "security", focus: "Security", question: "Security" },
            { id: "implementation", focus: "Implementation", question: "Implementation" }
          ] }) };
          if (system.includes("Reviewer Agent")) return { response: JSON.stringify({ complete: true, issues: [] }) };
          if (system.includes("Writer Agent")) return { response: "Report cites https://not-in-manifest.example/page." };
          return { response: "Findings." };
        }
      }
    }
  });
  assert.equal(result.sourceAudit.unmatchedCitationCount, 1);
  assert.equal(result.sourceAudit.unmatched[0], "https://not-in-manifest.example/page");
});
