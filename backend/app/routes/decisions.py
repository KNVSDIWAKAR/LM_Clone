"""Decision Inbox: cases paused at a playbook gate. Deciding resumes them."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..core.database import get_db
from ..engine import runner
from ..schemas.decisions import DecideRequest, DecideResult, DecisionOut

router = APIRouter(prefix="/api/decisions", tags=["decisions"])


def decision_out(db: Session, d: models.Decision) -> DecisionOut:
    loan = db.get(models.Msp, d.loan_id)
    return DecisionOut.model_validate(
        {
            **{c: getattr(d, c) for c in DecisionOut.model_fields if hasattr(d, c)},
            "borrower_name": loan.borrower_name if loan else "",
            "stage_name": models.STAGE_BY_NO[d.stage_no].name,
        }
    )


@router.get("", response_model=list[DecisionOut])
def list_decisions(status: str | None = None, db: Session = Depends(get_db)) -> list[DecisionOut]:
    query = select(models.Decision).order_by(models.Decision.created_at.desc())
    if status is not None:
        query = query.where(models.Decision.status == status)
    return [decision_out(db, d) for d in db.scalars(query)]


@router.get("/{decision_id}", response_model=DecisionOut)
def get_decision(decision_id: str, db: Session = Depends(get_db)) -> DecisionOut:
    d = db.get(models.Decision, decision_id)
    if d is None:
        raise HTTPException(status_code=404, detail="Decision not found")
    return decision_out(db, d)


@router.post("/{decision_id}/decide", response_model=DecideResult)
def decide(decision_id: str, body: DecideRequest, db: Session = Depends(get_db)) -> DecideResult:
    d = db.get(models.Decision, decision_id)
    if d is None:
        raise HTTPException(status_code=404, detail="Decision not found")
    if d.status != "pending":
        raise HTTPException(status_code=409, detail=f"Decision is already {d.status}")
    if body.decision == "rejected" and not (body.note or "").strip():
        raise HTTPException(status_code=422, detail="Say why when rejecting")

    lock = runner.loan_lock(d.loan_id)
    with lock:
        try:
            run = runner.resume(db, d, body.decision == "approved", body.decided_by, body.note)
        except ValueError as err:
            raise HTTPException(status_code=409, detail=str(err)) from err
        db.commit()
    wf = run.workflow_run
    return DecideResult(
        decision=decision_out(db, d),
        stage_status=runner.stage_status(db, d.loan_id, d.stage_no),
        workflow_status=wf.status if wf else None,
        workflow_outcome=wf.outcome if wf else None,
    )
