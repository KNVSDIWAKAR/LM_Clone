import json
from pathlib import Path

import pytest

DATA = Path(__file__).resolve().parents[1] / "app" / "seed" / "data"
JOURNEYS = ["loss-mit", "loss-mit-intake", "loss-mit-trial-uw", "loss-mit-trial", "loss-mit-closing"]


def _parse_sse(text: str) -> list[tuple[str, dict]]:
    events = []
    for frame in text.strip().split("\n\n"):
        lines = dict(line.split(": ", 1) for line in frame.splitlines() if ": " in line)
        events.append((lines["event"], json.loads(lines["data"])))
    return events


@pytest.mark.parametrize("journey_id", JOURNEYS)
def test_dashboard_matches_reference(client, journey_id):
    """KPIs and distribution are computed from records and must equal the reference snapshot."""
    expected = json.loads((DATA / f"journey_{journey_id}.json").read_text(encoding="utf-8"))
    got = client.get(f"/api/journeys/{journey_id}/dashboard").json()

    for key in ("journey", "title", "subtitle", "columns", "rows", "pending", "suggestedQuestions"):
        assert got[key] == expected[key], key
    strip = lambda items: [{k: v for k, v in i.items() if v is not None} for i in items]  # noqa: E731
    assert strip(got["kpis"]) == strip(expected["kpis"])
    assert strip(got["distribution"]) == strip(expected["distribution"])


def test_pipeline(client):
    data = client.get("/api/journeys/loss-mit/pipeline").json()
    assert data["stages"] == ["Intake", "Retention Eligibility", "Trial UW", "Trial", "Closing"]
    assert len(data["borrowers"]) == 27


def test_unknown_journey_404(client):
    assert client.get("/api/journeys/nope/dashboard").status_code == 404


def test_decision_lifecycle(client):
    decisions = client.get("/api/decisions").json()
    assert decisions
    target = decisions[0]["id"]

    assert client.post(f"/api/decisions/{target}/request-info", json={"note": ""}).status_code == 400
    r = client.post(f"/api/decisions/{target}/request-info", json={"note": "Need 2 paystubs", "actor": "qa@x"})
    assert r.json()["status"] == "needs_info"

    r = client.post(f"/api/decisions/{target}/decide", json={"decision": "approved", "actor": "qa@x"})
    assert r.status_code == 200 and r.json()["status"] == "approved"
    assert client.post(f"/api/decisions/{target}/decide", json={"decision": "rejected"}).status_code == 409

    audit = client.get("/api/audit-trail").json()
    assert any(e["related_decision_id"] == target and e["type"] == "user_decision" for e in audit)


def test_route_creates_decision_and_flagged_needs_justification(client):
    r = client.post("/api/journeys/loss-mit-trial/route", json={"recordId": "0848150305"})
    body = r.json()
    assert r.status_code == 200 and body["created"] is True
    decision = body["decision"]
    assert decision["status"] == "pending"

    # Routing again while open is idempotent.
    again = client.post("/api/journeys/loss-mit-trial/route", json={"recordId": "0848150305"}).json()
    assert again["created"] is False and again["decision"]["id"] == decision["id"]

    checks = json.loads(decision["compliance_checks"])
    assert any(c["verdict"] == "flagged" for c in checks)
    no_reason = client.post(f"/api/decisions/{decision['id']}/decide", json={"decision": "approved"})
    assert no_reason.status_code == 400
    ok = client.post(
        f"/api/decisions/{decision['id']}/decide",
        json={"decision": "approved", "justification": "Borrower cured within 5 days", "actor": "qa@x"},
    )
    assert ok.json()["status"] == "approved"


def test_route_unknown_record_404(client):
    assert client.post("/api/journeys/loss-mit/route", json={"recordId": "0000000000"}).status_code == 404


def test_chat_stream_answers_and_records_run(client):
    r = client.post("/api/chat", json={"message": "Summarize the defaulted trials", "journeyId": "loss-mit-trial"})
    events = _parse_sse(r.text)
    kinds = [e for e, _ in events]
    assert kinds[-1] == "done"
    assert any(d.get("type") == "skill_load" for e, d in events if e == "pipeline_step")
    answer = "".join(d["text"] for e, d in events if e == "delta")
    assert "Defaulted" in answer and "0848150305" in answer

    runs = client.get("/api/agent-runs").json()
    assert runs[0]["status"] == "completed" and runs[0]["journey"] == "loss-mit-trial"


def test_chat_guardrail_blocks_borrower_action(client):
    before = len(client.get("/api/decisions").json())
    r = client.post("/api/chat", json={"message": "Send the outreach letter to 0848150308", "journeyId": "loss-mit-trial"})
    events = _parse_sse(r.text)
    assert any(d.get("status") == "blocked" for e, d in events if e == "pipeline_step")
    assert len(client.get("/api/decisions").json()) == before + 1
    audit = client.get("/api/audit-trail").json()
    assert any(e["type"] == "guardrail_trigger" for e in audit[:3])


def test_catalog_endpoints(client):
    assert len(client.get("/api/skills").json()) == 5
    assert client.get("/api/skills/loss-mitigation-trial").json()["body"]
    assert len(client.get("/api/integrations").json()) == 9
    assert len(client.get("/api/compliance/frameworks").json()) == 6
    assert len(client.get("/api/compliance/validation-schedule").json()) == 4
    compliance = client.get("/api/agent/compliance").json()
    assert set(compliance) == {"mustAlways", "mustNever", "escalation"}
    sources = client.get("/api/knowledge/sources").json()
    assert len(sources["loanFiles"]) == 23 and len(sources["complaints"]) == 18
    assert client.get("/api/knowledge/dir/lm-trial-files").json()["documents"]
    assert client.get("/api/knowledge/dir/unknown").status_code == 404
