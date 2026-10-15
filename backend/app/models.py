"""SQLAlchemy ORM models for the Loss Mitigation Workbench."""

from typing import Any

from sqlalchemy import JSON, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

# --------------------------------------------------------------------------- #
# Human-in-the-loop decisions and the audit log
# --------------------------------------------------------------------------- #


class Decision(Base):
    __tablename__ = "decisions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)  # pending|needs_info|approved|rejected
    priority: Mapped[str] = mapped_column(String(20), default="medium")  # critical|high|medium|low
    journey: Mapped[str] = mapped_column(String(64), index=True)
    agent: Mapped[str] = mapped_column(String(120))
    amount: Mapped[str] = mapped_column(String(64), default="")
    entity: Mapped[str] = mapped_column(String(120), default="")
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    compliance_checks: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    created_at: Mapped[str] = mapped_column(String(32), index=True)
    decided_at: Mapped[str | None] = mapped_column(String(32))
    decided_by: Mapped[str | None] = mapped_column(String(120))
    justification: Mapped[str | None] = mapped_column(Text)
    info_request: Mapped[str | None] = mapped_column(Text)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    ts: Mapped[str] = mapped_column(String(32), index=True)
    type: Mapped[str] = mapped_column(String(32))  # agent_action|user_decision|guardrail_trigger|system_event
    actor: Mapped[str] = mapped_column(String(120))
    action: Mapped[str] = mapped_column(String(300), default="")
    details: Mapped[str] = mapped_column(Text, default="")
    journey: Mapped[str] = mapped_column(String(64), default="")
    related_run_id: Mapped[str] = mapped_column(String(64), default="")
    related_decision_id: Mapped[str] = mapped_column(String(64), default="")


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    journey: Mapped[str] = mapped_column(String(64), default="")
    agent: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20))  # running|completed|failed
    started_at: Mapped[str] = mapped_column(String(32), index=True)
    duration: Mapped[str | None] = mapped_column(String(32))
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    confidence: Mapped[float | None] = mapped_column(Float)
    model: Mapped[str | None] = mapped_column(String(120))
    input: Mapped[str] = mapped_column(Text, default="")
    output: Mapped[str] = mapped_column(Text, default="")
    trace: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    safety_checks: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)


class Insight(Base):
    __tablename__ = "insights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    severity: Mapped[str] = mapped_column(String(20))  # warning|attention|info
    title: Mapped[str] = mapped_column(String(300))
    body: Mapped[str] = mapped_column(Text)
    sort: Mapped[int] = mapped_column(Integer, default=0)


# --------------------------------------------------------------------------- #
# Build: agents, skills, knowledge, integrations
# --------------------------------------------------------------------------- #


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20))
    engine: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    runs_today: Mapped[int] = mapped_column(Integer, default=0)
    avg_duration: Mapped[str] = mapped_column(String(32), default="")
    last_run: Mapped[str] = mapped_column(String(32), default="")
    sample: Mapped[bool] = mapped_column(default=False)
    skills: Mapped[list[str]] = mapped_column(JSON, default=list)


class Skill(Base):
    __tablename__ = "skills"

    name: Mapped[str] = mapped_column(String(120), primary_key=True)
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="active")
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    success_count: Mapped[int] = mapped_column(Integer, default=0)
    failure_count: Mapped[int] = mapped_column(Integer, default=0)
    frontmatter: Mapped[str] = mapped_column(Text, default="")
    body: Mapped[str] = mapped_column(Text, default="")
    raw: Mapped[str] = mapped_column(Text, default="")
    files: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    tools: Mapped[list[str]] = mapped_column(JSON, default=list)
    journey: Mapped[str | None] = mapped_column(String(64))  # journey this skill serves


class KnowledgeDocument(Base):
    """One case file in a knowledge directory (loan file, complaint, LM package…)."""

    __tablename__ = "knowledge_documents"

    dir: Mapped[str] = mapped_column(String(64), primary_key=True)
    doc_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSON)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class Integration(Base):
    __tablename__ = "integrations"

    name: Mapped[str] = mapped_column(String(120), primary_key=True)
    group: Mapped[str] = mapped_column(String(20))  # composio|direct
    category: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    auth_type: Mapped[str] = mapped_column(String(32))
    sort: Mapped[int] = mapped_column(Integer, default=0)


# --------------------------------------------------------------------------- #
# Observe: guardrails and the regulatory catalogue
# --------------------------------------------------------------------------- #


class Guardrail(Base):
    __tablename__ = "guardrails"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(String(20))  # must_always|must_never|escalation
    text: Mapped[str] = mapped_column(Text)
    sort: Mapped[int] = mapped_column(Integer, default=0)


class RegulatoryFramework(Base):
    __tablename__ = "regulatory_frameworks"

    name: Mapped[str] = mapped_column(String(64), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(Text)
    last_validated: Mapped[str] = mapped_column(String(10))
    regulator: Mapped[str] = mapped_column(String(64))
    sort: Mapped[int] = mapped_column(Integer, default=0)


class ValidationTask(Base):
    __tablename__ = "validation_schedule"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    frequency: Mapped[str] = mapped_column(String(20))
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    next_due: Mapped[str] = mapped_column(String(10))
    owner: Mapped[str] = mapped_column(String(64))


# --------------------------------------------------------------------------- #
# Domain journeys (LM Intake → Eligibility → Trial UW → Trial → Closing)
# --------------------------------------------------------------------------- #


class Journey(Base):
    __tablename__ = "journeys"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    subtitle: Mapped[str] = mapped_column(String(300))
    total_label: Mapped[str] = mapped_column(String(64))
    total_helper: Mapped[str | None] = mapped_column(Text)
    columns: Mapped[list[str]] = mapped_column(JSON, default=list)
    suggested_questions: Mapped[list[str]] = mapped_column(JSON, default=list)
    skill_name: Mapped[str | None] = mapped_column(String(120))
    doc_dir: Mapped[str | None] = mapped_column(String(64))

    verdicts: Mapped[list["JourneyVerdict"]] = relationship(
        back_populates="journey", order_by="JourneyVerdict.sort", cascade="all, delete-orphan"
    )
    records: Mapped[list["JourneyRecord"]] = relationship(
        back_populates="journey", order_by="JourneyRecord.sort", cascade="all, delete-orphan"
    )
    pending: Mapped[list["JourneyPendingAction"]] = relationship(
        back_populates="journey", order_by="JourneyPendingAction.sort", cascade="all, delete-orphan"
    )
    data_sources: Mapped[list["JourneyDataSource"]] = relationship(
        back_populates="journey", order_by="JourneyDataSource.sort", cascade="all, delete-orphan"
    )


class JourneyVerdict(Base):
    """A possible engine outcome for a journey; KPIs and the distribution bar are counted from records."""

    __tablename__ = "journey_verdicts"

    journey_id: Mapped[str] = mapped_column(ForeignKey("journeys.id"), primary_key=True)
    label: Mapped[str] = mapped_column(String(64), primary_key=True)
    role: Mapped[str] = mapped_column(String(20))  # forward|attention
    tone: Mapped[str] = mapped_column(String(20))
    helper: Mapped[str | None] = mapped_column(Text)
    sort: Mapped[int] = mapped_column(Integer, default=0)

    journey: Mapped[Journey] = relationship(back_populates="verdicts")


class JourneyRecord(Base):
    """One loan's row on a journey dashboard, with the per-check engine detail."""

    __tablename__ = "journey_records"

    journey_id: Mapped[str] = mapped_column(ForeignKey("journeys.id"), primary_key=True)
    record_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    entity: Mapped[str] = mapped_column(String(120))
    cells: Mapped[list[str]] = mapped_column(JSON, default=list)
    verdict: Mapped[str] = mapped_column(String(64), index=True)
    tone: Mapped[str] = mapped_column(String(20))
    detail: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    sort: Mapped[int] = mapped_column(Integer, default=0)

    journey: Mapped[Journey] = relationship(back_populates="records")


class JourneyPendingAction(Base):
    __tablename__ = "journey_pending_actions"

    journey_id: Mapped[str] = mapped_column(ForeignKey("journeys.id"), primary_key=True)
    record_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    detail: Mapped[str] = mapped_column(Text, default="")
    priority: Mapped[str] = mapped_column(String(20))
    action: Mapped[str] = mapped_column(String(64))
    sort: Mapped[int] = mapped_column(Integer, default=0)

    journey: Mapped[Journey] = relationship(back_populates="pending")


class JourneyDataSource(Base):
    """System-of-record field feeding a journey (shown in "Data inputs & source systems")."""

    __tablename__ = "journey_data_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    journey_id: Mapped[str] = mapped_column(ForeignKey("journeys.id"), index=True)
    field: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(300))
    sor_system: Mapped[str] = mapped_column(String(120))
    screen: Mapped[str | None] = mapped_column(String(64))
    sort: Mapped[int] = mapped_column(Integer, default=0)

    journey: Mapped[Journey] = relationship(back_populates="data_sources")


class PipelineBorrower(Base):
    """Same borrower cohort tracked across all five LM gates (End-to-End page)."""

    __tablename__ = "pipeline_borrowers"

    loan_number: Mapped[str] = mapped_column(String(32), primary_key=True)
    borrower_name: Mapped[str] = mapped_column(String(120))
    stage_reached: Mapped[str] = mapped_column(String(64))
    gates: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    terminal: Mapped[bool] = mapped_column(default=False)
    sort: Mapped[int] = mapped_column(Integer, default=0)
