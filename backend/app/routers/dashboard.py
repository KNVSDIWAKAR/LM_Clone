from fastapi import APIRouter, Depends
from sqlalchemy import case, select
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..services.serializers import decision_out

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

PRIORITY_ORDER = case(
    {"critical": 0, "high": 1, "medium": 2, "low": 3},
    value=models.Decision.priority,
    else_=4,
)


@router.get("/insights")
def insights(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(models.Insight).order_by(models.Insight.sort))
    return [{"severity": i.severity, "title": i.title, "body": i.body} for i in rows]


@router.get("/actions")
def actions(limit: int = 5, db: Session = Depends(get_db)) -> list[dict]:
    """Pending decisions that need a human, most urgent first."""
    rows = db.scalars(
        select(models.Decision)
        .where(models.Decision.status == "pending")
        .order_by(PRIORITY_ORDER, models.Decision.created_at.desc())
        .limit(limit)
    )
    return [decision_out(d) for d in rows]
