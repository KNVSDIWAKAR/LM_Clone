"""Decision Inbox workflow: routing journey records for review, deciding, and requesting info."""

from sqlalchemy.orm import Session

from .. import models
from ..config import settings
from ..utils import new_id, utc_now_iso
from .audit import record_event

DEFAULT_REVIEWER = "reviewer@workbench.local"
CLOSED_STATUSES = {"approved", "rejected"}


class DecisionError(Exception):
    """Business-rule violation; surfaced to the client as a 4xx with this message."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _checks_from_record(record: models.JourneyRecord) -> list[dict]:
    """Map engine check verdicts onto compliance-check verdicts (pass / warning / flagged)."""
    mapping = {"pass": "pass", "pending": "warning"}
    return [
        {"name": c["name"], "verdict": mapping.get(c.get("verdict"), "flagged"), "detail": c.get("detail", "")}
        for c in record.detail
    ]


def route_record(
    db: Session, journey: models.Journey, record_id: str
) -> tuple[models.Decision, bool]:
    """Create (or return the open) Decision Inbox item for a journey record. Returns (decision, created)."""
    existing = (
        db.query(models.Decision)
        .filter(
            models.Decision.journey == journey.id,
            models.Decision.entity == record_id,
            models.Decision.status.in_(["pending", "needs_info"]),
        )
        .first()
    )
    if existing:
        return existing, False

    record = next((r for r in journey.records if r.record_id == record_id), None)
    pending = next((p for p in journey.pending if p.record_id == record_id), None)
    if record is None and pending is None:
        raise DecisionError(f"Record {record_id} not found in {journey.id}", status_code=404)

    if pending is not None:
        title = f"{pending.action}: {pending.title}"
        description = pending.detail
        priority = pending.priority
    else:
        title = f"Review: {record.verdict} — {record_id} ({record.entity})"
        issues = [c.get("detail", "") for c in record.detail if c.get("verdict") != "pass"]
        description = " ".join(issues) or f"Engine verdict {record.verdict}; confirm before it is communicated."
        priority = "high" if record.tone == "bad" else "medium"

    checks = _checks_from_record(record) if record is not None else []
    decision = models.Decision(
        id=new_id("DI"),
        title=title,
        description=description,
        status="pending",
        priority=priority,
        journey=journey.id,
        agent=settings.agent_name,
        amount="",
        entity=record_id,
        payload={"loanNumber": record_id, "journey": journey.id, "verdict": record.verdict if record else None},
        compliance_checks=checks,
        created_at=utc_now_iso(),
    )
    db.add(decision)
    record_event(
        db,
        type="agent_action",
        actor=settings.agent_name,
        action="Routed to Decision Inbox",
        details=title,
        journey=journey.id,
        related_decision_id=decision.id,
    )
    db.commit()
    return decision, True


def decide(
    db: Session, decision: models.Decision, outcome: str, justification: str | None, actor: str | None
) -> models.Decision:
    if outcome not in CLOSED_STATUSES:
        raise DecisionError("decision must be 'approved' or 'rejected'")
    if decision.status in CLOSED_STATUSES:
        raise DecisionError(f"Decision is already {decision.status}", status_code=409)

    flagged = any(c.get("verdict") == "flagged" for c in decision.compliance_checks or [])
    if outcome == "approved" and flagged and not (justification or "").strip():
        raise DecisionError("A written justification is required to approve over flagged compliance checks.")

    reviewer = actor or DEFAULT_REVIEWER
    decision.status = outcome
    decision.decided_at = utc_now_iso()
    decision.decided_by = reviewer
    decision.justification = (justification or "").strip() or None

    verb = "Approved" if outcome == "approved" else "Rejected"
    if outcome == "approved" and flagged:
        verb = "Approved with override"
    details = decision.title + (f" — Justification: {decision.justification}" if decision.justification else "")
    record_event(
        db,
        type="user_decision",
        actor=reviewer,
        action=verb,
        details=details,
        journey=decision.journey,
        related_decision_id=decision.id,
    )
    db.commit()
    return decision


def request_info(db: Session, decision: models.Decision, note: str | None, actor: str | None) -> models.Decision:
    if decision.status in CLOSED_STATUSES:
        raise DecisionError(f"Decision is already {decision.status}", status_code=409)
    if not (note or "").strip():
        raise DecisionError("Describe the information needed.")

    reviewer = actor or DEFAULT_REVIEWER
    decision.status = "needs_info"
    decision.info_request = note.strip()
    record_event(
        db,
        type="user_decision",
        actor=reviewer,
        action="Requested more information",
        details=f"{decision.title} — {decision.info_request}",
        journey=decision.journey,
        related_decision_id=decision.id,
    )
    db.commit()
    return decision
