# Surgify AI — Backend

FastAPI backend for the Surgify AI surgical-simulation trainer. Deterministic simulation
state machine, rule-based AI coach, weighted scoring, live WebSocket updates, simulated
vitals, and an optional webcam vision pipeline. **No external AI API or trained model is
required to run the full demo.**

> **Medical disclaimer** — Surgify AI is an educational prototype for simulated skills
> training. It is not intended for real-patient use, diagnosis, clinical decision-making,
> treatment planning, medication guidance, or certification of surgical competence.

## Architecture

Monorepo layout: the Next.js frontend lives in `frontend/`; this backend lives in
`backend/` as a self-contained [uv](https://docs.astral.sh/uv/) project.

```
backend/
  app/
    main.py            FastAPI app, CORS, error envelope
    config.py          pydantic-settings (env-driven)
    database.py        SQLAlchemy engine (SQLite)
    models.py          DB tables (sessions, events, results, coach messages, trajectory)
    schemas.py         Pydantic request/response models
    api/               routers: catalog, sessions, results, vision, websocket
    services/
      data_store.py    JSON loaders + frontend-label → id adapter
      simulation_engine.py  pure functional core + imperative persistence shell
      scoring_engine.py     weighted 0–100 scoring (weights sum to 1.0)
      coaching_engine.py    deterministic rule-based coach (optional LLM adapter stub)
      vitals.py             mock vitals drift
      vision.py             mock / opencv / mediapipe adapters
      websocket_manager.py  per-session broadcast + cleanup
    data/              scenarios/, instruments, patients, anatomy, coach rules (editable JSON)
  scripts/             seed_data.py, smoke_check.py
  docs/                frontend contract, websocket events, scenario authoring
  frontend-types/      surgify-api.ts (copy into the frontend)
```

Domain definitions (scenarios, instruments, patients, anatomy) are version-controlled
JSON — only runtime data (sessions, events, results, trajectories, coach messages) hits
the database.

## Quick start (local)

```bash
cd backend
uv sync                          # install deps (creates .venv)
uv run python -m scripts.seed_data   # create tables + demo data
uv run uvicorn app.main:app --reload # http://localhost:8000
```

Windows: `uv sync` then `uv run uvicorn app.main:app --reload` (uv manages the venv;
no manual activation needed. If you activate manually: `.venv\Scripts\activate`).

Or from the repo root: `make api` / `make seed` / `make smoke` / `make dev` (both apps).

## Environment variables

See `.env.example`. Highlights:

| var | default | notes |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./surgify.db` | SQLite file — no database server needed |
| `FRONTEND_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | CORS allowlist (no wildcard) |
| `VISION_MODE` | `mock` | `mock` \| `opencv` \| `mediapipe` |
| `DEMO_MODE` | `true` | anonymous sessions, mock vision, no keys needed |
| `ANTHROPIC_API_KEY` | empty | **not required** — coach is rule-based |

## Database

Tables are created automatically at startup (`Base.metadata.create_all`). Migration +
seed in one command:

```bash
uv run python -m scripts.seed_data
```

(No Alembic — schema churn during a hackathon is handled by recreating the dev DB.)

## API

- Base URL: `http://localhost:8000/api/v1`
- Swagger: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- WebSocket: `ws://localhost:8000/ws/sessions/{session_id}`

Full endpoint table and usage examples: `docs/frontend-api-contract.md`.
WebSocket message reference: `docs/websocket-events.md`.
Adding scenarios: `docs/scenario-authoring.md`.

## Vision modes

- `mock` (default): deterministic pseudo-detections — demo-safe, zero dependencies.
- `opencv`: ArUco-marker + HSV color-marker tool-tip detection (`uv sync --extra vision`).
  Missing markers degrade to low confidence + warning, never a crash.
- `mediapipe`: hand landmarks if `mediapipe` is installed; otherwise falls back to mock
  with a warning.

Target frame upload rate: 2–5 fps (`POST /api/v1/vision/frame`, JPEG/PNG multipart, ≤5 MB).

## Demo workflow

1. `make seed && make api` (from the repo root)
2. Frontend: `GET /scenarios` → pick `forearm-laceration`
3. `POST /sessions` → `POST /sessions/{id}/start` → open the WebSocket channel
4. Submit events per step (patient review → region → assessment → prep → instruments →
   guided suturing → reassess → complete); coach + vitals + metrics stream live
5. Final step auto-generates the result → `GET /sessions/{id}/results`

`scripts/smoke_check.py` drives this entire flow end-to-end (`make smoke`).

## Frontend integration

- Copy `frontend-types/surgify-api.ts` into the frontend.
- Set `NEXT_PUBLIC_SURGIFY_API_URL=http://localhost:8000/api/v1` and
  `NEXT_PUBLIC_SURGIFY_WS_URL=ws://localhost:8000`.
- Event payloads may use the frontend's existing display labels ("Right arm",
  "Needle holder") — the backend normalizes them.

## Known prototype limitations

- No authentication (anonymous sessions; `user_id` is nullable by design).
- No Alembic migrations — `create_all` + seed script only.
- Vision `opencv`/`mediapipe` modes need markers/lighting; `mock` is the demo path.
- Vitals are cosmetic drift, not a physiological model.
- Elapsed time is client-reported (`elapsed_ms`), clamped server-side but trusted.
- One process; WebSocket fan-out is in-memory (no Redis), so run a single instance.
