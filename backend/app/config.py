from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Runtime configuration, overridable via environment variables or backend/.env."""

    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", env_prefix="LMW_", extra="ignore")

    database_url: str = f"sqlite:///{(BACKEND_DIR / 'data' / 'workbench.db').as_posix()}"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    # Re-seed on startup when the database is empty.
    auto_seed: bool = True
    # Pacing of the simulated agent stream (seconds). Set to 0 in tests.
    stream_step_delay: float = 0.35
    stream_token_delay: float = 0.012

    agent_name: str = "Mortgage Operations Orchestrator"
    agent_model: str = "lmw-deterministic-engine-v1"


settings = Settings()
