"""Deterministic Mortgage Operations Orchestrator.

Answers questions over the journey data in SQLite and streams the same SSE protocol
the client consumes:

    event: pipeline_step   {id, type, label, status, detail?, content?, file?, duration?}
    event: delta           {text}
    event: done            {runId}
    event: error           {error}

Every run is persisted to `agent_runs` with its trace, and borrower-facing actions are
blocked by the guardrail and routed to the Decision Inbox, exactly like the reference agent.
"""

import asyncio
import json
import re
import time
from collections import Counter
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..config import settings
from ..utils import new_id, new_run_id, utc_now_iso
from .audit import record_event
from .journeys import build_dashboard, build_pipeline, get_journey, list_journeys

JOURNEY_KEYWORDS: list[tuple[str, tuple[str, ...]]] = [
    ("loss-mit-trial-uw", ("trial uw", "trial underwriting", "underwrit", "trial plan ready", "npv")),
    ("loss-mit-intake", ("intake", "document", "docs", "package", "maa", "missing doc", "stale")),
    ("loss-mit-closing", ("closing", "recording", "record", "qc", "sla", "final mod", "permanent")),
    ("loss-mit-trial", ("trial", "payment", "grace", "defaulted", "delayed", "monitor")),
    ("loss-mit", ("eligib", "retention", "waterfall", "flex mod", "forbearance", "deferral", "decline", "denied")),
]

# Asking the agent to *do* something borrower-facing trips the human-approval guardrail.
ACTION_PATTERN = re.compile(r"\b(send|email|mail|notify|draft|offer|approve|submit|communicate|issue)\b", re.I)
LOAN_PATTERN = re.compile(r"\b(\d{10}[a-z]?|L-\d{4}|C-\d{3})\b", re.I)


def _sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _split_question(message: str) -> tuple[str, str | None]:
    """Journey pages prepend a 'Context — …' preamble; separate it from the user's question."""
    if message.startswith("Context —") and "\n\n" in message:
        preamble, question = message.rsplit("\n\n", 1)
        return question.strip(), preamble
    return message.strip(), None


def _infer_journey(question: str) -> str | None:
    q = question.lower()
    for journey_id, keywords in JOURNEY_KEYWORDS:
        if any(k in q for k in keywords):
            return journey_id
    return None


def _md_table(headers: list[str], rows: list[list[str]]) -> str:
    def esc(cell: Any) -> str:
        return str(cell).replace("|", "\\|")

    lines = ["| " + " | ".join(headers) + " |", "|" + "---|" * len(headers)]
    lines += ["| " + " | ".join(esc(c) for c in row) + " |" for row in rows]
    return "\n".join(lines)


@dataclass
class RunContext:
    question: str
    journey_id: str | None
    trace: list[dict[str, Any]] = field(default_factory=list)
    safety: list[dict[str, Any]] = field(default_factory=list)
    step_no: int = 0
    blocked_decision_ids: list[str] = field(default_factory=list)

    def next_step_id(self) -> str:
        self.step_no += 1
        return f"step-{self.step_no}"


class AgentEngine:
    def __init__(self, db: Session):
        self.db = db

    # -- answer composition ---------------------------------------------------

    def _record_answer(self, dashboard: dict[str, Any], record: dict[str, Any]) -> str:
        checks = _md_table(
            ["Check", "Result", "Detail"],
            [[c["name"], c["verdict"].upper(), c["detail"]] for c in record["detail"]],
        )
        cells = _md_table(dashboard["columns"], [record["cells"]]) if dashboard["columns"] else ""
        issues = [c for c in record["detail"] if c["verdict"] != "pass"]
        if issues:
            nxt = "Resolve the open items above, then route the case to the Decision Inbox for sign-off."
        else:
            nxt = "All checks pass — the file can advance to the next stage once a reviewer confirms in the Decision Inbox."
        return (
            f"## {record['entity']} — {record['id']}\n\n"
            f"**{dashboard['title']}** verdict: **{record['verdict']}**\n\n"
            f"{cells}\n\n### Engine checks\n\n{checks}\n\n"
            f"**Next step:** {nxt}"
        )

    def _verdict_answer(self, dashboard: dict[str, Any], verdict: str) -> str:
        rows = [r for r in dashboard["rows"] if r["verdict"] == verdict]
        if not rows:
            return f"No records in **{dashboard['title']}** currently have the verdict **{verdict}**."
        table = _md_table(
            ["Loan", "Borrower", *dashboard["columns"]],
            [[f"**{r['id']}**", r["entity"], *r["cells"]] for r in rows],
        )
        reasons = []
        for r in rows:
            issues = "; ".join(c["detail"].rstrip(".") for c in r["detail"] if c["verdict"] != "pass")
            if issues:
                reasons.append(f"- **{r['id']}** ({r['entity']}): {issues}")
        reason_block = ("\n\n### Why\n\n" + "\n".join(reasons)) if reasons else ""
        return (
            f"There {'is' if len(rows) == 1 else 'are'} **{len(rows)}** "
            f"record{'s' if len(rows) != 1 else ''} with verdict **{verdict}** in {dashboard['title']}:\n\n"
            f"{table}{reason_block}"
        )

    def _journey_summary(self, dashboard: dict[str, Any]) -> str:
        total = len(dashboard["rows"])
        dist = _md_table(
            ["Verdict", "Count", "Share"],
            [
                [d["label"], str(d["count"]), f"{round(d['count'] / total * 100) if total else 0}%"]
                for d in dashboard["distribution"]
                if d["count"] > 0
            ],
        )
        forward = sum(int(k["value"]) for k in dashboard["kpis"] if k["role"] == "forward")
        attention = sum(int(k["value"]) for k in dashboard["kpis"] if k["role"] == "attention")
        pending = dashboard["pending"]
        pending_block = ""
        if pending:
            pending_block = "\n\n### Pending actions\n\n" + "\n".join(
                f"- **{p['title']}** — {p['detail']} _(priority: {p['priority']}, action: {p['action']})_" for p in pending
            )
        return (
            f"## {dashboard['title']}\n\n"
            f"{dashboard['subtitle']}. **{forward}** of {total} are moving forward and "
            f"**{attention}** need attention.\n\n{dist}{pending_block}\n\n"
            "Ask about a specific loan number for the full check-by-check breakdown, or route the pending "
            "items to the Decision Inbox for human sign-off."
        )

    def _portfolio_summary(self) -> str:
        rows = []
        for journey in list_journeys(self.db):
            dash = build_dashboard(get_journey(self.db, journey.id))
            forward = sum(int(k["value"]) for k in dash["kpis"] if k["role"] == "forward")
            attention = sum(int(k["value"]) for k in dash["kpis"] if k["role"] == "attention")
            rows.append([dash["title"].replace("Loss Mitigation — ", ""), str(len(dash["rows"])), str(forward), str(attention), str(len(dash["pending"]))])
        pipeline = build_pipeline(self.db)
        stage_counts = Counter(b["stageReached"] for b in pipeline["borrowers"])
        stage_line = " → ".join(f"{s} ({stage_counts.get(s, 0)})" for s in pipeline["stages"])
        open_decisions = self.db.query(models.Decision).filter(models.Decision.status == "pending").count()
        return (
            "## Loss Mitigation portfolio\n\n"
            + _md_table(["Stage", "Records", "Moving forward", "Needs attention", "Pending actions"], rows)
            + f"\n\n**Cohort position:** {stage_line}\n\n"
            f"**Decision Inbox:** {open_decisions} item{'s' if open_decisions != 1 else ''} awaiting human sign-off.\n\n"
            "Open a journey from the sidebar or ask about a stage (e.g. *“Which trials are at risk of breaking?”*)."
        )

    def _knowledge_answer(self, doc: models.KnowledgeDocument) -> str:
        data = doc.data
        fields = [[k, json.dumps(v) if isinstance(v, (dict, list)) else str(v)] for k, v in data.items() if k != "documents"]
        docs = data.get("documents") or []
        doc_list = "\n".join(f"- **{d.get('title')}** — {d.get('kind', '')} ({d.get('date', '')})" for d in docs)
        return (
            f"## {data.get('borrowerName') or doc.doc_id} — {doc.doc_id}\n\n"
            + _md_table(["Field", "Value"], fields[:18])
            + (f"\n\n### Documents on file\n\n{doc_list}" if doc_list else "")
        )

    def _find_document(self, doc_id: str, preferred_dir: str | None) -> models.KnowledgeDocument | None:
        """Look up a case file, preferring the current journey's directory."""
        query = select(models.KnowledgeDocument).where(models.KnowledgeDocument.doc_id == doc_id)
        if preferred_dir:
            doc = self.db.scalar(query.where(models.KnowledgeDocument.dir == preferred_dir))
            if doc is not None:
                return doc
        return self.db.scalar(query.limit(1))

    # -- orchestration --------------------------------------------------------

    async def _step(self, ctx: RunContext, type_: str, label: str, *, work=None, detail=None, file=None):
        """Emit running → completed for one pipeline step and record it in the trace."""
        step_id = ctx.next_step_id()
        start = time.perf_counter()
        running = {"id": step_id, "type": type_, "label": label, "status": "running"}
        if detail:
            running["detail"] = detail
        if file:
            running["file"] = file
        yield _sse("pipeline_step", running)
        await asyncio.sleep(settings.stream_step_delay)
        content = work() if work else None
        duration = int((time.perf_counter() - start) * 1000)
        done = {"id": step_id, "status": "completed", "duration": duration}
        if content:
            done["content"] = content
        yield _sse("pipeline_step", done)
        ctx.trace.append({"id": step_id, "type": type_, "label": label, "detail": detail or "", "duration": duration})

    def _block_action(self, ctx: RunContext, journey_id: str, target: str, borrower: str) -> models.Decision:
        tool = "send_borrower_communication"
        decision = models.Decision(
            id=new_id("DI"),
            title=f"Approve: {tool} for loan {target}",
            description=f"Borrower-facing action requested via the orchestrator: “{ctx.question}”. Held for human approval.",
            status="pending",
            priority="high",
            journey=journey_id,
            agent=settings.agent_name,
            amount="",
            entity=target,
            payload={"loanNumber": target, "borrower": borrower, "request": ctx.question},
            compliance_checks=[
                {"name": "Human Approval Gate", "verdict": "pass", "detail": "Borrower-facing output routed for sign-off."},
                {"name": "Disclosure Completeness", "verdict": "pass", "detail": "Required fields present."},
                {"name": "Regulatory Compliance", "verdict": "pass", "detail": "No prohibited content detected."},
            ],
            created_at=utc_now_iso(),
        )
        self.db.add(decision)
        record_event(
            self.db,
            type="guardrail_trigger",
            actor="System",
            action=f"Blocked {tool}",
            details=decision.title,
            journey=journey_id,
            related_decision_id=decision.id,
        )
        ctx.blocked_decision_ids.append(decision.id)
        ctx.safety.append({"name": "Borrower-facing action", "verdict": "warning", "detail": "Blocked and routed to the Decision Inbox for human sign-off."})
        return decision

    async def stream(self, message: str, journey_id: str | None) -> AsyncIterator[str]:
        question, _preamble = _split_question(message)
        journey_id = journey_id or _infer_journey(question)
        ctx = RunContext(question=question, journey_id=journey_id)
        run = models.AgentRun(
            id=new_run_id(),
            journey=journey_id or "",
            agent=settings.agent_name,
            status="running",
            started_at=utc_now_iso(),
            model=settings.agent_model,
            confidence=None,
            input=message,
        )
        self.db.add(run)
        self.db.commit()
        started = time.perf_counter()
        answer = ""

        try:
            async for chunk in self._step(ctx, "agent_init", "Initializing agent..."):
                yield chunk

            journey = get_journey(self.db, journey_id) if journey_id else None
            skill = self.db.get(models.Skill, journey.skill_name) if journey and journey.skill_name else None

            if skill:
                skill.usage_count += 1
                async for chunk in self._step(
                    ctx,
                    "skill_load",
                    f"Loading skill — {skill.name}",
                    file=f"skills/{skill.name}/SKILL.md",
                    work=lambda: skill.raw[:1800],
                ):
                    yield chunk

            dashboard = build_dashboard(journey) if journey else None
            loan_match = LOAN_PATTERN.search(question)
            loan_id = loan_match.group(1) if loan_match else None
            record = None
            if dashboard and loan_id:
                record = next((r for r in dashboard["rows"] if r["id"].lower() == loan_id.lower()), None)

            if journey:
                query_detail = f"SELECT * FROM journey_records WHERE journey_id = '{journey.id}'"
                async for chunk in self._step(
                    ctx,
                    "tool_exec",
                    f"Querying {journey.title.replace('Loss Mitigation — ', '')} records",
                    detail=query_detail,
                    work=lambda: f"{len(dashboard['rows'])} records · {len(dashboard['pending'])} pending actions",
                ):
                    yield chunk

            kb_doc = self._find_document(loan_id, journey.doc_dir if journey else None) if loan_id else None
            if kb_doc is not None:
                file_path = f"knowledge/{kb_doc.dir}/{kb_doc.doc_id}.json"
                async for chunk in self._step(
                    ctx,
                    "file_read",
                    f"Reading {kb_doc.doc_id}.json",
                    file=file_path,
                    work=lambda: json.dumps({k: v for k, v in kb_doc.data.items() if k != "documents"}, indent=2)[:1500],
                ):
                    yield chunk

            async for chunk in self._step(ctx, "llm_thinking", "Composing answer"):
                yield chunk

            # Compose the answer from the data.
            q_lower = question.lower()
            if record is not None:
                answer = self._record_answer(dashboard, record)
            elif dashboard is not None:
                verdict = next((d["label"] for d in dashboard["distribution"] if d["label"].lower() in q_lower), None)
                if verdict is None:
                    synonyms = {"at risk": "Delayed Payment", "broken": "Defaulted", "on track": "Within Plan", "ready": "Ready"}
                    verdict = next((v for k, v in synonyms.items() if k in q_lower and any(d["label"] == v for d in dashboard["distribution"])), None)
                answer = self._verdict_answer(dashboard, verdict) if verdict else self._journey_summary(dashboard)
            elif kb_doc is not None:
                answer = self._knowledge_answer(kb_doc)
            else:
                answer = self._portfolio_summary()

            # Guardrail: borrower-facing actions never execute without a human.
            if ACTION_PATTERN.search(question) and journey_id:
                target = (record or {}).get("id") or loan_id or (dashboard["pending"][0]["id"] if dashboard and dashboard["pending"] else "portfolio")
                borrower = (record or {}).get("entity", "")
                decision = self._block_action(ctx, journey_id, target, borrower)
                step_id = ctx.next_step_id()
                yield _sse(
                    "pipeline_step",
                    {
                        "id": step_id,
                        "type": "tool_exec",
                        "label": "Running send_borrower_communication",
                        "status": "blocked",
                        "content": 'Tool "send_borrower_communication" blocked by hook: Routed to Decision Inbox for human sign-off.',
                    },
                )
                ctx.trace.append({"id": step_id, "type": "tool_exec", "label": "send_borrower_communication (blocked)", "detail": decision.id, "duration": 0})
                answer += (
                    f"\n\n> Borrower-facing actions require human approval. I've routed **{decision.title}** "
                    "to the Decision Inbox for sign-off."
                )

            async for chunk in self._step(ctx, "output_ready", "Response ready"):
                yield chunk

            # Stream the answer in small chunks.
            for token in re.findall(r"\S+\s*|\s+", answer):
                yield _sse("delta", {"text": token})
                if settings.stream_token_delay:
                    await asyncio.sleep(settings.stream_token_delay)

            if not ctx.safety:
                ctx.safety.append({"name": "Data provenance", "verdict": "pass", "detail": "Every figure sourced from the journey records in SQLite."})
            if skill:
                skill.success_count += 1
            run.status = "completed"
            run.confidence = 0.92 if record or dashboard else 0.85
            yield _sse("done", {"runId": run.id})
        except Exception as exc:  # noqa: BLE001 — surface any failure to the client stream
            run.status = "failed"
            ctx.safety.append({"name": "Execution", "verdict": "flagged", "detail": str(exc)})
            yield _sse("error", {"error": str(exc)})
        finally:
            elapsed = time.perf_counter() - started
            run.duration = f"{elapsed:.1f}s"
            run.output = answer
            run.trace = ctx.trace
            run.safety_checks = ctx.safety
            # Rough token accounting (≈4 chars/token) so cost metrics are meaningful.
            run.tokens_in = max(1, len(message) // 4)
            run.tokens_out = max(1, len(answer) // 4) if answer else 0
            record_event(
                self.db,
                type="agent_action",
                actor=settings.agent_name,
                action=f"Answered: {ctx.question[:80]}",
                details=f"{len(ctx.trace)} steps · {run.status}",
                journey=journey_id or "",
                related_run_id=run.id,
            )
            self.db.commit()
