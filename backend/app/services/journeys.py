"""Journey dashboards: KPIs and the verdict distribution are derived from the stored records."""

from collections import Counter
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import models
from .serializers import data_source_out, record_out

PIPELINE_STAGES = ["Intake", "Retention Eligibility", "Trial UW", "Trial", "Closing"]


def get_journey(db: Session, journey_id: str) -> models.Journey | None:
    return db.scalar(
        select(models.Journey)
        .where(models.Journey.id == journey_id)
        .options(
            selectinload(models.Journey.verdicts),
            selectinload(models.Journey.records),
            selectinload(models.Journey.pending),
            selectinload(models.Journey.data_sources),
        )
    )


def list_journeys(db: Session) -> list[models.Journey]:
    return list(db.scalars(select(models.Journey)))


def build_dashboard(journey: models.Journey) -> dict[str, Any]:
    counts = Counter(r.verdict for r in journey.records)

    kpis: list[dict[str, Any]] = [
        {"label": journey.total_label, "value": str(len(journey.records)), "role": "total", "helper": journey.total_helper},
    ]
    distribution: list[dict[str, Any]] = []
    for v in journey.verdicts:
        count = counts.get(v.label, 0)
        kpis.append({"label": v.label, "value": str(count), "role": v.role, "tone": v.tone, "helper": v.helper})
        distribution.append({"label": v.label, "count": count, "tone": v.tone, "helper": v.helper})

    return {
        "journey": journey.id,
        "title": journey.title,
        "subtitle": journey.subtitle,
        "kpis": kpis,
        "columns": journey.columns,
        "rows": [record_out(r) for r in journey.records],
        "distribution": distribution,
        "pending": [
            {"id": p.record_id, "title": p.title, "detail": p.detail, "priority": p.priority, "action": p.action}
            for p in journey.pending
        ],
        "suggestedQuestions": journey.suggested_questions,
        "dataSources": [data_source_out(s) for s in journey.data_sources],
    }


def build_pipeline(db: Session) -> dict[str, Any]:
    borrowers = db.scalars(select(models.PipelineBorrower).order_by(models.PipelineBorrower.sort))
    return {
        "stages": PIPELINE_STAGES,
        "borrowers": [
            {
                "loanNumber": b.loan_number,
                "borrowerName": b.borrower_name,
                "stageReached": b.stage_reached,
                "gates": b.gates,
                "terminal": b.terminal,
            }
            for b in borrowers
        ],
    }
