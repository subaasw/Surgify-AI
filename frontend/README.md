# Surgify AI

Surgify AI is a polished frontend-only hackathon prototype for accessible, webcam-based surgical skills training. It uses realistic mock data and simulated interactions; it does not provide clinical guidance, diagnosis, certification, or real-patient support.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal (normally `http://localhost:3000`).

## Routes

- `/` — immediately redirects into the simulation
- `/simulation` — immersive virtual patient room and guided wound-closure scenario
- `/scenarios` — clinical simulation launcher
- `/anatomy` — full-screen interactive anatomy lab
- `/instruments` — full-screen 3D instrument training environment
- `/results` — scenario-specific performance review
- `/settings` — local simulation preferences and data reset

## Stack

Next.js App Router, TypeScript, Tailwind CSS, React Three Fiber, Drei, Recharts, Lucide React, and Framer Motion.

## Prototype integration points

- `components/simulation/WebcamPractice.tsx` streams sampled camera frames to the local FastAPI MediaPipe pipeline and maps stable hand gestures to simulator actions.
- `components/simulation/SimulationProvider.tsx` owns the rule-based scenario, checklist, scoring, and coach state.
- `components/simulation/HospitalScene.tsx` builds the complete room, patient, equipment, wound patch, and guided instrument scene procedurally.
- `data/modelConfig.ts` is the central registry for future freely licensed GLB/GLTF assets; named procedural fallbacks remain the reliable offline default.
- `data/mockData.ts` contains the local scenario, session, anatomy, and analytics datasets.

All session, score, streak, and preference persistence in this prototype is device-local via `localStorage`.
