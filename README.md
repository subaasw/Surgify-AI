# Surgify AI

AI-assisted surgical simulation and skills-training prototype for a hackathon.

> **Medical disclaimer** — Surgify AI is an educational prototype for simulated skills
> training. It is not intended for real-patient use, diagnosis, clinical decision-making,
> treatment planning, medication guidance, or certification of surgical competence.

## Monorepo layout

```text
frontend/   Next.js + React Three Fiber app   → http://localhost:3000
backend/    FastAPI simulation backend (uv)   → http://localhost:8000
Makefile    Orchestrates both applications
```

## Quick start

```bash
make install
make seed
make dev
```

Or run each application directly:

```bash
cd frontend && npm run dev
cd backend && uv run uvicorn app.main:app --reload
```

Run the backend end-to-end check with `make smoke`.

## Documentation

- Backend API and setup: `backend/README.md` (Swagger at http://localhost:8000/docs)
- Frontend/backend contract: `backend/docs/frontend-api-contract.md`
- WebSocket events: `backend/docs/websocket-events.md`
- Scenario authoring: `backend/docs/scenario-authoring.md`
- Shared API types: `backend/frontend-types/surgify-api.ts`

## Frontend integration points

- `frontend/components/simulation/WebcamPractice.tsx` contains the optional live camera surface.
- Webcam practice sends sampled frames to the FastAPI MediaPipe pipeline; stable hand
  gestures select the forearm, pick/release instruments, and advance scenario actions.
- `frontend/components/simulation/SimulationProvider.tsx` owns the rule-based scenario, checklist, scoring, and coach state.
- `frontend/components/simulation/HospitalScene.tsx` combines the procedural clinical room with the supplied textured patient and instrument assets.
- `frontend/components/simulation/ModelRegistry.tsx` normalizes GLB/FBX scale, preserves authored textures, applies clinical materials, and activates procedural fallbacks.
- `frontend/data/modelConfig.ts` is the central registry for assets in `frontend/public/3d`.
- `frontend/data/mockData.ts` contains the local scenario, session, anatomy, and analytics datasets.

Frontend session, score, streak, and preference persistence is device-local through `localStorage`.

## 3D asset attribution

- “Patient” by [edouard77](https://sketchfab.com/edouard77), licensed under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/). [Source model](https://sketchfab.com/3d-models/patient-00b483f284a542899b94e99831f1ad1c).
- “Realistic Human Heart” by [neshallads](https://sketchfab.com/neshallads), licensed under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/). [Source model](https://sketchfab.com/3d-models/realistic-human-heart-3f8072336ce94d18b3d0d055a1ece089).
- Remaining files in `frontend/public/3d` are project-supplied assets; confirm their source licenses before distribution outside the prototype.
