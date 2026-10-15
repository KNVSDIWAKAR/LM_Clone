from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..database import SessionLocal
from ..schemas import ChatRequest
from ..services.agent_engine import AgentEngine

router = APIRouter(prefix="/api", tags=["chat"])


@router.post("/chat")
async def chat(body: ChatRequest) -> StreamingResponse:
    """Server-sent events stream of the orchestrator's pipeline steps and answer."""

    async def events() -> AsyncIterator[str]:
        # The stream outlives the request scope, so it owns its session.
        with SessionLocal() as db:
            async for chunk in AgentEngine(db).stream(body.message, body.journey_id):
                yield chunk

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
