from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..schemas import DecideRequest, RequestInfoRequest
from ..services import decisions as service
from ..services.serializers import decision_out

router = APIRouter(prefix="/api/decisions", tags=["decisions"])


def _get_or_404(db: Session, decision_id: str) -> models.Decision:
    decision = db.get(models.Decision, decision_id)
    if decision is None:
        raise HTTPException(status_code=404, detail="Decision not found")
    return decision


@router.get("")
def list_decisions(status: str | None = None, db: Session = Depends(get_db)) -> list[dict]:
    query = select(models.Decision).order_by(models.Decision.created_at.desc())
    if status:
        query = query.where(models.Decision.status == status)
    return [decision_out(d) for d in db.scalars(query)]


@router.get("/{decision_id}")
def get_decision(decision_id: str, db: Session = Depends(get_db)) -> dict:
    return decision_out(_get_or_404(db, decision_id))


@router.post("/{decision_id}/decide")
def decide(decision_id: str, body: DecideRequest, db: Session = Depends(get_db)) -> dict:
    decision = _get_or_404(db, decision_id)
    try:
        service.decide(db, decision, body.decision, body.justification, body.actor)
    except service.DecisionError as err:
        raise HTTPException(status_code=err.status_code, detail=err.message) from err
    return decision_out(decision)


@router.post("/{decision_id}/request-info")
def request_info(decision_id: str, body: RequestInfoRequest, db: Session = Depends(get_db)) -> dict:
    decision = _get_or_404(db, decision_id)
    try:
        service.request_info(db, decision, body.note, body.actor)
    except service.DecisionError as err:
        raise HTTPException(status_code=err.status_code, detail=err.message) from err
    return decision_out(decision)
