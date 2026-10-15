"""Request bodies. Responses are plain dicts shaped in services/serializers.py."""

from typing import Literal

from pydantic import BaseModel, Field


class DecideRequest(BaseModel):
    decision: Literal["approved", "rejected"]
    justification: str | None = None
    actor: str | None = None


class RequestInfoRequest(BaseModel):
    note: str | None = None
    actor: str | None = None


class RouteRequest(BaseModel):
    record_id: str = Field(alias="recordId", min_length=1)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=50_000)
    journey_id: str | None = Field(default=None, alias="journeyId")
