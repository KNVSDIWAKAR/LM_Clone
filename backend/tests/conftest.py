import os
import tempfile
from pathlib import Path

# Point the app at a throwaway database and disable stream pacing before it is imported.
_tmp = Path(tempfile.mkdtemp()) / "test.db"
os.environ["LMW_DATABASE_URL"] = f"sqlite:///{_tmp.as_posix()}"
os.environ["LMW_STREAM_STEP_DELAY"] = "0"
os.environ["LMW_STREAM_TOKEN_DELAY"] = "0"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed.seed import init_db  # noqa: E402


@pytest.fixture()
def client():
    init_db(reset=True)
    with TestClient(app) as c:
        yield c
