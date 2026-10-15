"""ORM → API payloads. Field names and shapes match what the React client expects."""

import json
from typing import Any

from .. import models


def decision_out(d: models.Decision) -> dict[str, Any]:
    return {
        "id": d.id,
        "title": d.title,
        "description": d.description,
        "status": d.status,
        "priority": d.priority,
        "journey": d.journey,
        "agent": d.agent,
        "amount": d.amount,
        "entity": d.entity,
        # Encoded as JSON strings: the client parses these defensively.
        "payload": json.dumps(d.payload or {}),
        "compliance_checks": json.dumps(d.compliance_checks or []),
        "created_at": d.created_at,
        "decided_at": d.decided_at,
        "decided_by": d.decided_by,
        "justification": d.justification,
        "info_request": d.info_request,
    }


def audit_out(e: models.AuditEvent) -> dict[str, Any]:
    return {
        "id": e.id,
        "ts": e.ts,
        "type": e.type,
        "actor": e.actor,
        "action": e.action,
        "details": e.details,
        "journey": e.journey,
        "related_run_id": e.related_run_id,
        "related_decision_id": e.related_decision_id,
    }


def run_out(r: models.AgentRun) -> dict[str, Any]:
    return {
        "id": r.id,
        "journey": r.journey,
        "agent": r.agent,
        "status": r.status,
        "started_at": r.started_at,
        "duration": r.duration,
        "tokens_in": r.tokens_in,
        "tokens_out": r.tokens_out,
        "confidence": r.confidence,
        "model": r.model,
        "input": r.input,
        "output": r.output,
        "trace": json.dumps(r.trace or []),
        "safety_checks": json.dumps(r.safety_checks or []),
    }


def skill_summary_out(s: models.Skill) -> dict[str, Any]:
    return {
        "name": s.name,
        "description": s.description,
        "status": s.status,
        "confidence": s.confidence,
        "usageCount": s.usage_count,
        "successCount": s.success_count,
    }


def skill_detail_out(s: models.Skill) -> dict[str, Any]:
    return {
        "name": s.name,
        "description": s.description,
        "confidence": s.confidence,
        "usageCount": s.usage_count,
        "successCount": s.success_count,
        "failureCount": s.failure_count,
        "frontmatter": s.frontmatter,
        "body": s.body,
        "raw": s.raw,
        "files": s.files or [],
        "tools": s.tools or [],
    }


def agent_out(a: models.Agent) -> dict[str, Any]:
    return {
        "id": a.id,
        "name": a.name,
        "status": a.status,
        "engine": a.engine,
        "description": a.description,
        "runsToday": a.runs_today,
        "avgDuration": a.avg_duration,
        "lastRun": a.last_run,
        "sample": a.sample,
        "skills": a.skills or [],
    }


def integration_out(i: models.Integration) -> dict[str, Any]:
    return {
        "name": i.name,
        "group": i.group,
        "category": i.category,
        "description": i.description,
        "authType": i.auth_type,
    }


def framework_out(f: models.RegulatoryFramework) -> dict[str, Any]:
    return {
        "name": f.name,
        "fullName": f.full_name,
        "status": f.status,
        "description": f.description,
        "lastValidated": f.last_validated,
        "regulator": f.regulator,
    }


def validation_task_out(t: models.ValidationTask) -> dict[str, Any]:
    return {
        "frequency": t.frequency,
        "name": t.name,
        "description": t.description,
        "next": t.next_due,
        "owner": t.owner,
    }


def data_source_out(s: models.JourneyDataSource) -> dict[str, Any]:
    out: dict[str, Any] = {"field": s.field, "description": s.description, "sorSystem": s.sor_system}
    if s.screen:
        out["screen"] = s.screen
    return out


def record_out(r: models.JourneyRecord) -> dict[str, Any]:
    return {
        "id": r.record_id,
        "entity": r.entity,
        "cells": r.cells,
        "verdict": r.verdict,
        "tone": r.tone,
        "detail": r.detail,
    }
