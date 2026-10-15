# Mortgage Agentic Workbench — Loss Mitigation

A rebuild of the Loss Mitigation Workbench: a **React (JavaScript)** client and a **FastAPI + SQLite** backend.

```
Loss_Mitigation/
├── backend/                 FastAPI · SQLAlchemy · SQLite
│   ├── app/
│   │   ├── main.py          app factory, CORS, routers, serves frontend/dist in production
│   │   ├── models.py        ORM tables
│   │   ├── routers/         dashboard · decisions · journeys · observe · build · chat
│   │   ├── services/        journeys (KPIs from records) · decisions · audit · agent_engine (SSE)
│   │   └── seed/            seed.py + data/*.json reference dataset
│   ├── data/workbench.db    created on first start
│   └── tests/               pytest suite
└── frontend/                React 18 · Vite · Tailwind v4 · TanStack Query · wouter · framer-motion · d3
    └── src/
        ├── pages/           one file per screen
        ├── components/      layout · ui · chat · journey · knowledge · decisions
        ├── hooks/           useAgentChat (SSE client)
        └── lib/             api, utils, navigation, compliance helpers, LM pipeline model
```

## Run it

**Backend** (Python 3.10+):

```bash
cd backend
py -3.10 -m venv .venv                       # macOS/Linux: python3 -m venv .venv
.venv\Scripts\activate                       # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000    # creates + seeds data/workbench.db on first start
```

API docs: http://localhost:8000/docs

**Frontend** (Node 18+):

```bash
cd frontend
npm install
npm run dev                                   # http://localhost:5173 (proxies /api → :8000)
```

**Single-origin production build:** run `npm run build` in `frontend/`, then start the backend; it serves `frontend/dist` at http://localhost:8000.

## Data

Everything lives in SQLite. Journey **KPIs and the verdict distribution are computed from the stored records**, so anything that changes a record changes the dashboards. Approving, rejecting, requesting info and routing all write the decision and an audit-trail entry.

Reset to the original dataset:

```bash
cd backend && python -m app.seed.seed --reset
```

Configuration uses environment variables with the `LMW_` prefix (or `backend/.env`): `LMW_DATABASE_URL`, `LMW_CORS_ORIGINS`, `LMW_STREAM_STEP_DELAY`, `LMW_STREAM_TOKEN_DELAY`.

## The orchestrator (`POST /api/chat`)

It streams the same SSE protocol as the reference (`pipeline_step`, `delta`, `done`, `error`). The engine is **deterministic**: it loads the journey's skill, queries SQLite and reads the case file. It then answers with tables built from real records: a journey summary, all loans with a given verdict, or one loan's check-by-check breakdown. Borrower-facing requests ("send", "draft", "offer", …) are **blocked by the guardrail** and routed to the Decision Inbox. Every run is saved to Agent Runs with its trace and safety checks.

## Tests

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest -q
```

The suite checks that each computed journey dashboard is identical to the reference dataset. It also covers the decision lifecycle, override justification, routing idempotency, the chat stream and the guardrail.
