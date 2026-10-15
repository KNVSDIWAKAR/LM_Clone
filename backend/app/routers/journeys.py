from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..schemas import RouteRequest
from ..services import decisions as decision_service
from ..services.journeys import build_dashboard, build_pipeline, get_journey
from ..services.serializers import data_source_out, decision_out

router = APIRouter(prefix="/api/journeys", tags=["journeys"])


@router.get("/loss-mit/pipeline")
def pipeline(db: Session = Depends(get_db)) -> dict:
    """Cohort view across all five LM gates (declared before the /{journey_id} routes)."""
    return build_pipeline(db)


def _journey_or_404(db: Session, journey_id: str):
    journey = get_journey(db, journey_id)
    if journey is None:
        raise HTTPException(status_code=404, detail="Unknown journey")
    return journey


@router.get("/{journey_id}/dashboard")
def dashboard(journey_id: str, db: Session = Depends(get_db)) -> dict:
    return build_dashboard(_journey_or_404(db, journey_id))


@router.get("/{journey_id}/data-sources")
def data_sources(journey_id: str, db: Session = Depends(get_db)) -> list[dict]:
    return [data_source_out(s) for s in _journey_or_404(db, journey_id).data_sources]


@router.post("/{journey_id}/route")
def route(journey_id: str, body: RouteRequest, db: Session = Depends(get_db)) -> dict:
    """Send a journey record to the Decision Inbox (idempotent while the item is open)."""
    journey = _journey_or_404(db, journey_id)
    try:
        decision, created = decision_service.route_record(db, journey, body.record_id)
    except decision_service.DecisionError as err:
        raise HTTPException(status_code=err.status_code, detail=err.message) from err
    return {"ok": True, "created": created, "decision": decision_out(decision)}
