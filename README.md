# Surgify AI

Surgify AI is a polished frontend-only hackathon prototype for accessible, webcam-based surgical skills training. It uses realistic mock data and simulated interactions; it does not provide clinical guidance, diagnosis, certification, or real-patient support.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal (normally `http://localhost:3000`).

## Routes

- `/` — investor-style landing page
- `/dashboard` — training overview and recommendations
- `/training` and `/scenarios` — filterable scenario library
- `/training/suture` — simulated live suture training session
- `/anatomy` — interactive procedural 3D anatomy and instrument lab
- `/results` — score breakdown, trajectory replay, and AI feedback
- `/progress` — eight-week analytics, activity, levels, and achievements
- `/settings` — local prototype preferences and data reset

## Stack

Next.js App Router, TypeScript, Tailwind CSS, React Three Fiber, Drei, Recharts, Lucide React, and Framer Motion.

## Prototype integration points

- `components/training/WebcamSimulation.tsx` contains the demo feed and optional live camera surface. Real hand/tool tracking can replace the simulated overlay there.
- `components/training/TrainingSession.tsx` orchestrates the state for a future inference stream and session API.
- `data/modelConfig.ts` is the central registry for future freely licensed GLB/GLTF assets; procedural models remain the reliable offline fallback.
- `data/mockData.ts` contains the local scenario, session, anatomy, and analytics datasets.

All session, score, streak, and preference persistence in this prototype is device-local via `localStorage`.
