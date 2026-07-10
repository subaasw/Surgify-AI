# Surgify AI

AI-assisted surgical simulation and skills-training prototype (hackathon).

> **Medical disclaimer** — Surgify AI is an educational prototype for simulated skills
> training. It is not intended for real-patient use, diagnosis, clinical decision-making,
> treatment planning, medication guidance, or certification of surgical competence.

## Monorepo layout

```
frontend/   Next.js + React Three Fiber app   → http://localhost:3000
backend/    FastAPI simulation backend (uv)   → http://localhost:8000
Makefile    orchestrates both apps
```

## Quick start

```bash
make install    # npm install (frontend) + uv sync (backend)
make seed       # backend: create tables + demo data
make dev        # run frontend (:3000) and backend (:8000) together
```

Or run each app directly:

```bash
cd frontend && npm run dev
cd backend && uv run uvicorn app.main:app --reload
```

## Docs

- Backend API + setup: `backend/README.md` (Swagger at http://localhost:8000/docs)
- Frontend ↔ backend contract: `backend/docs/frontend-api-contract.md`
- WebSocket events: `backend/docs/websocket-events.md`
- Scenario authoring: `backend/docs/scenario-authoring.md`
- Copy-paste API types for the frontend: `backend/frontend-types/surgify-api.ts`

Backend end-to-end check: `make smoke`.
