from pathlib import Path


def test_orchestrator_prompt_has_safe_research_continuity_protocol():
    """Keep the DeerFlow-inspired ledger advisory and scoped to one graph run."""
    repo_root = Path(__file__).resolve().parents[4]
    prompt_path = (
        repo_root
        / "src"
        / "deep_researcher_agent"
        / "agents"
        / "deep_researcher"
        / "prompts"
        / "orchestrator.j2"
    )
    prompt = prompt_path.read_text(encoding="utf-8")

    assert "/shared/research_continuity.json" in prompt
    assert "verify the corresponding plan/note/artifact files" in prompt
    assert "The ledger is a progress aid, not proof" in prompt
    assert "Do not reuse this per-run ledger as cross-user or long-term memory" in prompt
    assert "Do not put credentials, access tokens" in prompt
