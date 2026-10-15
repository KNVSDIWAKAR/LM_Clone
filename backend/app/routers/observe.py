"""Agent runs, audit trail, guardrails and the regulatory catalogue."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..services.serializers import audit_out, framework_out, run_out, validation_task_out

router = APIRouter(prefix="/api", tags=["observe"])


@router.get("/agent-runs")
def agent_runs(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(models.AgentRun).order_by(models.AgentRun.started_at.desc()))
    return [run_out(r) for r in rows]


@router.get("/agent-runs/{run_id}")
def agent_run(run_id: str, db: Session = Depends(get_db)) -> dict:
    run = db.get(models.AgentRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run_out(run)


@router.get("/audit-trail")
def audit_trail(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(models.AuditEvent).order_by(models.AuditEvent.ts.desc()))
    return [audit_out(e) for e in rows]


@router.get("/agent/compliance")
def guardrails(db: Session = Depends(get_db)) -> dict:
    grouped: dict[str, list[str]] = {"mustAlways": [], "mustNever": [], "escalation": []}
    keys = {"must_always": "mustAlways", "must_never": "mustNever", "escalation": "escalation"}
    for g in db.scalars(select(models.Guardrail).order_by(models.Guardrail.kind, models.Guardrail.sort)):
        grouped[keys[g.kind]].append(g.text)
    return grouped


@router.get("/compliance/frameworks")
def frameworks(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(models.RegulatoryFramework).order_by(models.RegulatoryFramework.sort))
    return [framework_out(f) for f in rows]


@router.get("/compliance/validation-schedule")
def validation_schedule(db: Session = Depends(get_db)) -> list[dict]:
    rows = db.scalars(select(models.ValidationTask).order_by(models.ValidationTask.id))
    return [validation_task_out(t) for t in rows]
