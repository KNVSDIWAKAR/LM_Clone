from sqlalchemy.orm import Session

from .. import models
from ..utils import new_id, utc_now_iso


def record_event(
    db: Session,
    *,
    type: str,
    actor: str,
    action: str,
    details: str = "",
    journey: str = "",
    related_run_id: str = "",
    related_decision_id: str = "",
) -> models.AuditEvent:
    """Append an immutable audit-trail entry (caller commits)."""
    event = models.AuditEvent(
        id=new_id("AE"),
        ts=utc_now_iso(),
        type=type,
        actor=actor,
        action=action,
        details=details,
        journey=journey,
        related_run_id=related_run_id,
        related_decision_id=related_decision_id,
    )
    db.add(event)
    return event
