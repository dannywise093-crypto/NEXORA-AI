import test from "node:test";
import assert from "node:assert/strict";
import { runNexoraAgentTeam } from "./agent-orchestrator.js";


function mockPageFetch(status = 200, body = "<html><body><h1>Example research source</h1><p>" + "Verified page text with meaningful source details and technical context. ".repeat(5) + "</p></body></html>") {
  return async () => new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

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
              { id: "architecture", focus: "Platform Architecture", question: "Design the architecture" },
              { id: "security", focus: "Security Engineering", question: "Review security" },
              { id: "implementation", focus: "Implementation Engineering", question: "Plan implementation" },
              { id: "ai_models", focus: "AI Model and Agent Engineering", question: "Review model routing" },
              { id: "research_verification", focus: "Research and Evidence Verification", question: "Verify evidence" },
              { id: "performance", focus: "Performance and Reliability Engineering", question: "Review performance" }
            ] }) };
          }
          if (system.includes("Reviewer Agent")) {
            return { response: JSON.stringify({ complete: reviewComplete, issues: reviewComplete ? [] : ["Add an explicit rollback plan."], revision_instructions: "Add rollback guidance." }) };
          }
          if (system.includes("final revision")) return { response: "Complete revised report. Rollback plan included." };
          if (system.includes("Writer Agent")) return { response: "Complete technical report. See https://example.com/source for the source." };
          return { response: "Assessment for " + system + ". The analysis identifies the primary design constraints, operational assumptions, likely failure modes, and the evidence needed to validate the approach. Recommended actions are to establish explicit acceptance criteria, add focused automated tests, record measurable outcomes, review access boundaries, and document rollback procedures. Remaining uncertainty should be tracked as an open question rather than presented as a verified fact." };
        }
      }
    }
  };
}

test("Deterministic plan runs six specialists, Writer and optional Reviewer, then audits citations", async () => {
  const mock = mockEnvironment();
  const result = await runNexoraAgentTeam({
    prompt: "Design a secure research platform",
    evidence: "Evidence excerpt",
    sources: [{ provider: "test", title: "Example source", url: "https://example.com/source" }],
    env: mock.env,
    fetchImpl: mockPageFetch()
  });
  assert.equal(result.answer.includes("Complete technical report"), true);
  assert.equal(result.orchestration, "completed");
  assert.equal(result.executionSummary.completedSpecialists, 6);
  assert.equal(result.executionSummary.invalidSpecialists, 0);
  assert.equal(result.agents.every(agent => agent.status === "completed" && agent.durationMs >= 0), true);
  assert.equal(result.plan.length, 6);
  assert.equal(result.agents.length, 6);
  assert.equal(result.reviewer.complete, true);
  assert.equal(result.reviewer.revisionStatus, "disabled_for_latency");
  assert.equal(result.sourceAudit.matchedCitationCount, 1);
  assert.equal(result.sourceAudit.unmatchedCitationCount, 0);
  assert.equal(result.sourceAudit.pageContentsFetched, true);
  assert.equal(result.sourceAudit.verifiedPageCount, 1);
  assert.equal(result.sourceAudit.verifiedCitationCount, 1);
  assert.equal(result.sourceVerification.verified, 1);
  assert.equal(mock.calls.length, 8);
});

test("Reviewer findings do not block delivery with a slow revision pass", async () => {
  const mock = mockEnvironment({ reviewComplete: false });
  const result = await runNexoraAgentTeam({ prompt: "Plan a deployment", env: mock.env });
  assert.equal(result.reviewer.complete, false);
  assert.equal(result.reviewer.revisionStatus, "disabled_for_latency");
  assert.equal(result.answer, "Complete technical report. See https://example.com/source for the source.");
  assert.equal(mock.calls.length, 8);
});

test("Source audit flags citations that are not in the retrieved source manifest", async () => {
  const mock = mockEnvironment();
  const result = await runNexoraAgentTeam({
    prompt: "Design a platform",
    sources: [{ provider: "test", title: "Allowed", url: "https://example.com/source" }],
    fetchImpl: mockPageFetch(),
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


test("Acknowledgement-only specialist responses are rejected and reported as partial execution", async () => {
  const result = await runNexoraAgentTeam({
    prompt: "Perform a six-discipline architecture and security assessment",
    env: {
      AI: {
        async run(_model, input) {
          const system = input.messages[0].content;
          if (system.includes("Reviewer Agent")) return { response: JSON.stringify({ complete: true, issues: [] }) };
          if (system.includes("Writer Agent")) return { response: "The report is incomplete because specialist outputs failed validation. No specialist findings are asserted as completed." };
          return { response: "NEXORA CONNECTION TEST SUCCESSFUL" };
        }
      }
    }
  });
  assert.equal(result.orchestration, "partial");
  assert.equal(result.executionSummary.completedSpecialists, 0);
  assert.equal(result.executionSummary.invalidSpecialists, 6);
  assert.equal(result.agents.every(agent => agent.status === "invalid_output"), true);
});


test("Source page fetch rejects non-HTTPS and does not follow redirects", async () => {
  const calls = [];
  const result = await runNexoraAgentTeam({
    prompt: "Assess source verification controls",
    sources: [
      { provider: "test", title: "Insecure", url: "http://example.com/article" },
      { provider: "test", title: "Redirect", url: "https://example.com/redirect" }
    ],
    fetchImpl: async (url, options) => {
      calls.push({ url, redirect: options.redirect });
      return new Response("", { status: 302, headers: { location: "https://example.com/final" } });
    },
    env: {
      AI: { async run(_model, input) {
        const system = input.messages[0].content;
        if (system.includes("Reviewer Agent")) return { response: JSON.stringify({ complete: true, issues: [] }) };
        if (system.includes("Writer Agent")) return { response: "Source verification report. No page was verified, and these sources remain unverified." };
        return { response: "Assessment: the source controls require validation. This report identifies security boundaries, evidence gaps, failure handling, and tests. Recommendations include HTTPS enforcement, redirect review, response-size limits, content-type checks, and explicit citation status. Additional acceptance criteria include bounded request duration and rejection of local network addresses." };
      }}
    }
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].redirect, "manual");
  assert.equal(result.sourceVerification.results[0].fetchStatus, "rejected_url");
  assert.equal(result.sourceVerification.results[1].fetchStatus, "redirect_not_followed");
  assert.equal(result.sourceVerification.verified, 0);
  assert.equal(result.sourceAudit.pageContentsFetched, false);
});
