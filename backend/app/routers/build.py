"""Agents, skills, knowledge base and integrations."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models
from ..database import get_db
from ..services.serializers import agent_out, integration_out, skill_detail_out, skill_summary_out

router = APIRouter(prefix="/api", tags=["build"])


@router.get("/agents")
def agents(db: Session = Depends(get_db)) -> list[dict]:
    return [agent_out(a) for a in db.scalars(select(models.Agent))]


@router.get("/skills")
def skills(db: Session = Depends(get_db)) -> list[dict]:
    return [skill_summary_out(s) for s in db.scalars(select(models.Skill).order_by(models.Skill.name))]


@router.get("/skills/{name}")
def skill(name: str, db: Session = Depends(get_db)) -> dict:
    found = db.get(models.Skill, name)
    if found is None:
        raise HTTPException(status_code=404, detail="Skill not found")
    return skill_detail_out(found)


@router.get("/knowledge/sources")
def knowledge_sources(db: Session = Depends(get_db)) -> dict:
    def file_names(directory: str) -> list[str]:
        ids = db.scalars(
            select(models.KnowledgeDocument.doc_id)
            .where(models.KnowledgeDocument.dir == directory)
            .order_by(models.KnowledgeDocument.doc_id)
        )
        return [f"{doc_id}.json" for doc_id in ids]

    return {"loanFiles": file_names("loan-files"), "complaints": file_names("complaints")}


@router.get("/knowledge/dir/{directory}")
def knowledge_dir(directory: str, db: Session = Depends(get_db)) -> dict:
    docs = list(
        db.scalars(
            select(models.KnowledgeDocument)
            .where(models.KnowledgeDocument.dir == directory)
            .order_by(models.KnowledgeDocument.sort)
        )
    )
    if not docs:
        raise HTTPException(status_code=404, detail="Unknown document directory")
    return {"dir": directory, "documents": [{"id": d.doc_id, "data": d.data} for d in docs]}


@router.get("/integrations")
def integrations(db: Session = Depends(get_db)) -> list[dict]:
    return [integration_out(i) for i in db.scalars(select(models.Integration).order_by(models.Integration.sort))]
