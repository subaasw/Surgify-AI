# Frontend API contract

Copy `frontend-types/surgify-api.ts` into the frontend for all response types.

## Environment variables (frontend)

```env
NEXT_PUBLIC_SURGIFY_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_SURGIFY_WS_URL=ws://localhost:8000
```

## Identifier adapter

The backend uses snake_case ids everywhere (`right_forearm`, `needle_holder`). It **also
accepts the display labels already used in the frontend** (`"Right arm"`, `"Needle holder"`)
in event payloads, instrument lookups, and region lookups — they are normalized server-side.
Responses always contain canonical ids plus a `frontend_label` field on instruments/regions.

Frontend procedure phases map to `ScenarioStep.phase`:
`review | identify | assess | prepare | instruments | suture | complete` — the same ids as
`procedureSteps` in `data/simulationData.ts`. Checklist keys match `checklistItems` ids
(`review`, `allergy`, `identify`, `prepare`, `instruments`, `safety`, `complete`).

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | liveness |
| GET | `/scenarios?difficulty=&skill=&available=` | list scenarios |
| GET | `/scenarios/{id-or-slug}` | scenario detail with steps |
| GET | `/scenarios/{id}/patient` · `/tools` · `/anatomy-regions` | scenario resources |
| GET | `/patients/{id}` · `/vitals` · `/dialogue` | patient data |
| POST | `/patients/{id}/questions` | ask a predefined question |
| GET | `/instruments` · `/instruments/{id}` · `/instruments/{id}/parts` | instrument catalog |
| GET | `/anatomy/regions` · `/anatomy/regions/{id}` · `/structures` | anatomy metadata |
| POST | `/sessions` | create session |
| GET | `/sessions/{id}` | session state |
| POST | `/sessions/{id}/start` `/pause` `/resume` `/reset` `/complete` `/abandon` | lifecycle |
| POST | `/sessions/{id}/events` | **main interaction endpoint** |
| GET | `/sessions/{id}/coach` | coach message feed |
| POST | `/sessions/{id}/coach/hint` | request a hint (small score penalty) |
| POST | `/sessions/{id}/vision-metrics` | live tool metrics |
| POST/GET | `/sessions/{id}/trajectory` | batch store / replay tool trajectory |
| GET | `/sessions/{id}/results` | result for one session |
| GET | `/results` · `/results/{id}` | results history |
| POST | `/vision/frame` | MediaPipe webcam hand/gesture analysis (multipart) |

## Usage examples

```ts
const API = process.env.NEXT_PUBLIC_SURGIFY_API_URL!;

// 1. create + start a session
const created: SessionCreateResponse = await fetch(`${API}/sessions`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ scenario_id: "forearm-laceration", mode: "virtual_patient" }),
}).then(r => r.json());
await fetch(`${API}/sessions/${created.session.id}/start`, { method: "POST" });

// 2. submit an event (frontend labels are accepted)
const verdict: SimulationEventResponse = await fetch(`${API}/sessions/${created.session.id}/events`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "select_body_region", target: "Right arm", elapsed_ms: 38240 }),
}).then(r => r.json());

// 3. live updates + coaching
const ws = new WebSocket(`${process.env.NEXT_PUBLIC_SURGIFY_WS_URL}/ws/sessions/${created.session.id}`);
ws.onmessage = e => {
  const msg: WebSocketMessage = JSON.parse(e.data);
  if (msg.type === "coach.message") showCoach(msg.payload as FeedbackItem);
  if (msg.type === "vitals.updated") setVitals(msg.payload as PatientVitals);
};

// 4. upload a webcam frame (2–5 fps)
const form = new FormData();
form.append("frame", jpegBlob, "frame.jpg");
form.append("session_id", created.session.id);
const vision: VisionFrameResult = await fetch(`${API}/vision/frame`, { method: "POST", body: form })
  .then(r => r.json());

// MediaPipe hands contain 21 normalized landmarks, handedness, the index-finger
// pointer, canned gesture name/score, and a derived thumb/index pinch state.
const primaryHand = vision.hands[0];
if (primaryHand?.pinch) pickNearestTool(primaryHand.pointer);

// 5. complete + load results
await fetch(`${API}/sessions/${created.session.id}/complete`, { method: "POST" });
const result: SimulationResult = await fetch(`${API}/sessions/${created.session.id}/results`)
  .then(r => r.json());
```

## Errors

Every error uses one envelope (`ApiErrorEnvelope`): 400 malformed, 404 unknown resource,
409 invalid state transition, 413 oversized frame, 422 validation, 500 server fault.
`SimulationEventResponse.accepted === false` is **not** an HTTP error — wrong-but-legal
actions return 200 with feedback.
