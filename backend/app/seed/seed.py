"""Load the reference dataset in app/seed/data into SQLite.

Run directly to rebuild the database from scratch:

    python -m app.seed.seed --reset
"""

import argparse
import json
import logging
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..database import Base, SessionLocal, engine
from ..utils import normalize_timestamp

log = logging.getLogger(__name__)
DATA_DIR = Path(__file__).resolve().parent / "data"

JOURNEY_SKILLS = {
    "loss-mit-intake": "loss-mitigation-intake",
    "loss-mit": "loss-mitigation-eligibility",
    "loss-mit-trial-uw": "loss-mitigation-trial-underwriting",
    "loss-mit-trial": "loss-mitigation-trial",
    "loss-mit-closing": "loss-mitigation-closing",
}

JOURNEY_DOC_DIRS = {
    "loss-mit": "loss-mit-files",
    "loss-mit-intake": "lm-intake-files",
    "loss-mit-trial-uw": "lm-trial-uw-files",
    "loss-mit-trial": "lm-trial-files",
    "loss-mit-closing": "lm-modclose-files",
}

KNOWLEDGE_DIRS = ["loan-files", "complaints", *JOURNEY_DOC_DIRS.values()]


def _load(name: str) -> Any:
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


def _parse_json_field(value: Any, default: Any) -> Any:
    """The reference API stores some columns as JSON strings; accept either form."""
    if isinstance(value, str):
        try:
            return json.loads(value) if value else default
        except json.JSONDecodeError:
            return default
    return value if value is not None else default


def _seed_decisions(db: Session) -> None:
    for d in _load("decisions.json"):
        db.add(
            models.Decision(
                id=d["id"],
                title=d["title"],
                description=d.get("description") or "",
                status=d["status"],
                priority=d.get("priority") or "medium",
                journey=d.get("journey") or "",
                agent=d.get("agent") or "",
                amount=d.get("amount") or "",
                entity=d.get("entity") or "",
                payload=_parse_json_field(d.get("payload"), {}),
                compliance_checks=_parse_json_field(d.get("compliance_checks"), []),
                created_at=normalize_timestamp(d.get("created_at")),
            )
        )


def _seed_audit(db: Session) -> None:
    for e in _load("audit_trail.json"):
        db.add(
            models.AuditEvent(
                id=e["id"],
                ts=normalize_timestamp(e["ts"]),
                type=e["type"],
                actor=e.get("actor") or "",
                action=e.get("action") or "",
                details=e.get("details") or "",
                journey=e.get("journey") or "",
                related_run_id=e.get("related_run_id") or "",
                related_decision_id=e.get("related_decision_id") or "",
            )
        )


def _seed_runs(db: Session) -> None:
    for r in _load("agent_runs.json"):
        db.add(
            models.AgentRun(
                id=r["id"],
                journey=r.get("journey") or "",
                agent=r.get("agent") or "",
                status=r["status"],
                started_at=r["started_at"],
                duration=r.get("duration"),
                tokens_in=r.get("tokens_in") or 0,
                tokens_out=r.get("tokens_out") or 0,
                confidence=r.get("confidence"),
                model=r.get("model"),
                input=r.get("input") or "",
                output=r.get("output") or "",
                trace=_parse_json_field(r.get("trace"), []),
                safety_checks=_parse_json_field(r.get("safety_checks"), []),
            )
        )


def _seed_catalog(db: Session) -> None:
    for i, ins in enumerate(_load("insights.json")):
        db.add(models.Insight(severity=ins["severity"], title=ins["title"], body=ins["body"], sort=i))

    guardrails = _load("guardrails.json")
    for kind, key in (("must_always", "mustAlways"), ("must_never", "mustNever"), ("escalation", "escalation")):
        for i, text in enumerate(guardrails.get(key, [])):
            db.add(models.Guardrail(kind=kind, text=text, sort=i))

    for i, fw in enumerate(_load("regulatory_frameworks.json")):
        db.add(
            models.RegulatoryFramework(
                name=fw["name"],
                full_name=fw["fullName"],
                status=fw["status"],
                description=fw["description"],
                last_validated=fw["lastValidated"],
                regulator=fw["regulator"],
                sort=i,
            )
        )

    for task in _load("validation_schedule.json"):
        db.add(
            models.ValidationTask(
                frequency=task["frequency"],
                name=task["name"],
                description=task["description"],
                next_due=task["next"],
                owner=task["owner"],
            )
        )

    for i, it in enumerate(_load("integrations.json")):
        db.add(
            models.Integration(
                name=it["name"],
                group=it["group"],
                category=it["category"],
                description=it["description"],
                auth_type=it["authType"],
                sort=i,
            )
        )

    for a in _load("agents.json"):
        db.add(
            models.Agent(
                id=a["id"],
                name=a["name"],
                status=a["status"],
                engine=a["engine"],
                description=a["description"],
                runs_today=a["runsToday"],
                avg_duration=a["avgDuration"],
                last_run=a["lastRun"],
                sample=a["sample"],
                skills=a["skills"],
            )
        )


def _seed_skills(db: Session) -> None:
    status_by_name = {s["name"]: s.get("status", "active") for s in _load("skills.json")}
    skill_journeys = {skill: journey for journey, skill in JOURNEY_SKILLS.items()}
    for name in status_by_name:
        s = _load(f"skill_{name}.json")
        db.add(
            models.Skill(
                name=s["name"],
                description=s["description"],
                status=status_by_name[name],
                confidence=s.get("confidence") or 0.0,
                usage_count=s.get("usageCount") or 0,
                success_count=s.get("successCount") or 0,
                failure_count=s.get("failureCount") or 0,
                frontmatter=s.get("frontmatter") or "",
                body=s.get("body") or "",
                raw=s.get("raw") or "",
                files=s.get("files") or [],
                tools=s.get("tools") or [],
                journey=skill_journeys.get(name),
            )
        )


def _seed_knowledge(db: Session) -> None:
    for directory in KNOWLEDGE_DIRS:
        for i, doc in enumerate(_load(f"kb_{directory}.json")["documents"]):
            db.add(models.KnowledgeDocument(dir=directory, doc_id=doc["id"], data=doc["data"], sort=i))


def _seed_journeys(db: Session) -> None:
    data_sources = _load("journey_data_sources.json")

    for journey_id, skill_name in JOURNEY_SKILLS.items():
        dash = _load(f"journey_{journey_id}.json")
        total_kpi = next(k for k in dash["kpis"] if k["role"] == "total")
        journey = models.Journey(
            id=journey_id,
            title=dash["title"],
            subtitle=dash["subtitle"],
            total_label=total_kpi["label"],
            total_helper=total_kpi.get("helper"),
            columns=dash["columns"],
            suggested_questions=dash["suggestedQuestions"],
            skill_name=skill_name,
            doc_dir=JOURNEY_DOC_DIRS.get(journey_id),
        )

        verdict_kpis = [k for k in dash["kpis"] if k["role"] != "total"]
        for i, kpi in enumerate(verdict_kpis):
            journey.verdicts.append(
                models.JourneyVerdict(label=kpi["label"], role=kpi["role"], tone=kpi.get("tone") or "neutral", helper=kpi.get("helper"), sort=i)
            )

        for i, row in enumerate(dash["rows"]):
            journey.records.append(
                models.JourneyRecord(
                    record_id=row["id"],
                    entity=row["entity"],
                    cells=row["cells"],
                    verdict=row["verdict"],
                    tone=row["tone"],
                    detail=row["detail"],
                    sort=i,
                )
            )

        for i, item in enumerate(dash["pending"]):
            journey.pending.append(
                models.JourneyPendingAction(
                    record_id=item["id"],
                    title=item["title"],
                    detail=item.get("detail") or "",
                    priority=item["priority"],
                    action=item["action"],
                    sort=i,
                )
            )

        for i, src in enumerate(data_sources.get(journey_id, [])):
            journey.data_sources.append(
                models.JourneyDataSource(
                    field=src["field"],
                    description=src["description"],
                    sor_system=src["sorSystem"],
                    screen=src.get("screen"),
                    sort=i,
                )
            )

        db.add(journey)

    for i, b in enumerate(_load("pipeline.json")["borrowers"]):
        db.add(
            models.PipelineBorrower(
                loan_number=b["loanNumber"],
                borrower_name=b["borrowerName"],
                stage_reached=b["stageReached"],
                gates=b["gates"],
                terminal=bool(b.get("terminal")),
                sort=i,
            )
        )


def seed(db: Session) -> None:
    _seed_decisions(db)
    _seed_audit(db)
    _seed_runs(db)
    _seed_catalog(db)
    _seed_skills(db)
    _seed_knowledge(db)
    _seed_journeys(db)
    db.commit()


def init_db(reset: bool = False) -> None:
    """Create tables; seed when the database is empty (or after a reset)."""
    if reset:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(models.Journey.id).limit(1)) is None:
            log.info("Seeding database from %s", DATA_DIR)
            seed(db)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="Create and seed the workbench database.")
    parser.add_argument("--reset", action="store_true", help="drop all tables before seeding")
    init_db(reset=parser.parse_args().reset)
    print("Database ready.")
