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

- `components/simulation/WebcamPractice.tsx` contains the optional live camera surface. Real hand/tool tracking can replace the simulated overlay there.
- `components/simulation/SimulationProvider.tsx` owns the rule-based scenario, checklist, scoring, and coach state.
- `components/simulation/HospitalScene.tsx` combines the procedural clinical room with the supplied textured patient and instrument assets while preserving reliable interaction hit zones.
- `components/simulation/ModelRegistry.tsx` normalizes GLB/FBX scale, preserves authored textures, applies clinical materials to untextured meshes, and activates procedural fallbacks when an asset fails.
- `data/modelConfig.ts` is the central registry for the patient, instrument, and organ assets in `public/3d`.
- `data/mockData.ts` contains the local scenario, session, anatomy, and analytics datasets.

All session, score, streak, and preference persistence in this prototype is device-local via `localStorage`.

## 3D asset attribution

- “Patient” by [edouard77](https://sketchfab.com/edouard77), licensed under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/). [Source model](https://sketchfab.com/3d-models/patient-00b483f284a542899b94e99831f1ad1c).
- “Realistic Human Heart” by [neshallads](https://sketchfab.com/neshallads), licensed under [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/). [Source model](https://sketchfab.com/3d-models/realistic-human-heart-3f8072336ce94d18b3d0d055a1ece089).
- Remaining files in `public/3d` are project-supplied assets; confirm their source licenses before distribution outside the prototype.
