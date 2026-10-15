import uuid
from datetime import datetime, timezone


def utc_now_iso() -> str:
    """UTC timestamp in ISO-8601 with a trailing Z, second precision (e.g. 2026-10-15T07:41:35Z)."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def normalize_timestamp(value: str | None) -> str:
    """Coerce legacy 'YYYY-MM-DD HH:MM:SS' (UTC) values to ISO-8601 Z so browsers parse them as UTC."""
    if not value:
        return ""
    if "T" in value:
        return value if value.endswith("Z") else f"{value}Z"
    return f"{value.replace(' ', 'T')}Z"


def new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4()}"


def new_run_id() -> str:
    return f"run-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
