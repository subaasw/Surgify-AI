Surgify AI — Complete Project Context
AI-assisted surgical simulation and skills-training prototype built for a hackathon.

1. What Is Surgify AI?
Surgify AI is an immersive, browser-based surgical training simulator that lets medical students practice clinical procedures in a 3D virtual patient environment. It combines:

A 3D virtual operating room with a patient on a hospital bed
Real-time hand tracking via webcam using Google MediaPipe
A rule-based AI coach that guides trainees through procedure steps
Interactive anatomy exploration with layered organ visualization
Instrument inspection with rotatable 3D surgical tool models
Scored performance debriefs with detailed metric breakdowns
The platform runs entirely in the browser (no plugins, no downloads) and works with mouse/touch input or webcam-based hand gesture control.

IMPORTANT

Medical Disclaimer — Surgify AI is an educational prototype for simulated skills training. It is not intended for real-patient use, diagnosis, clinical decision-making, treatment planning, medication guidance, or certification of surgical competence.

2. Monorepo Structure

SurgifyAI-frontend/
├── frontend/          Next.js 16 + React Three Fiber app   → http://localhost:3000
├── backend/           FastAPI simulation backend (uv/Python) → http://localhost:8000
├── Makefile           Orchestrates both apps (install, dev, seed, smoke)
└── README.md          Project overview and 3D asset attributions
Quick Start
bash

make install    # npm install + uv sync
make seed       # Create tables + demo data
make dev        # Run frontend + backend concurrently
3. Tech Stack
Frontend
Technology	Version	Purpose
Next.js	16.2.6	React framework with App Router
React	19.2.6	UI component library
React Three Fiber	9.6.1	Declarative 3D rendering (Three.js wrapper)
@react-three/drei	10.7.7	R3F utilities (OrbitControls, useGLTF, Html)
Three.js	0.185.1	WebGL 3D engine
MediaPipe Tasks Vision	0.10.35	Browser-native hand gesture recognition
Framer Motion	12.42.2	UI animations
Recharts	3.9.2	Data visualization charts
Lucide React	1.24.0	Icon library
TypeScript	5.9.3	Type safety
Tailwind CSS	4.2.1	Utility classes (used selectively)
Vite	8.0.13	Build tooling via vinext
Backend
Technology	Purpose
FastAPI	REST API + WebSocket server
SQLAlchemy + SQLite	Database ORM + file-based storage
Pydantic	Request/response validation
uv	Python package manager
MediaPipe (server-side)	Optional vision pipeline for webcam frames
Deployment Target
Technology	Purpose
Cloudflare Workers	Edge deployment via @cloudflare/vite-plugin
D1	Cloudflare's SQL database
R2	Cloudflare's object storage
4. Frontend Architecture
4.1 App Router Layout

frontend/app/
├── layout.tsx              Root layout (fonts: Geist, Geist Mono, Manrope)
├── page.tsx                Landing → redirects to /scenarios
├── globals.css             Global design system (CSS variables, base styles)
└── (app)/                  App shell group (shared sidebar + SimulationProvider)
    ├── layout.tsx          Wraps all pages in SimulationProvider + AppRail
    ├── shell.css           App shell layout styles
    ├── clinical-light.css  Clinical UI component styles (~18KB)
    ├── scenarios/          Scenario library (training mission selection)
    ├── simulation/         3D simulation room (core experience)
    ├── anatomy/            Interactive anatomy lab (organ viewer)
    ├── instruments/        Instrument lab (3D tool inspection)
    ├── results/            Performance debrief dashboard
    └── settings/           User preferences and controls
4.2 Navigation
The app uses a left sidebar rail (
AppRail.tsx
) with 6 navigation links:

Route	Icon	Description
/scenarios	Boxes	Scenario library — choose a training mission
/simulation	Activity	3D simulation room — the core experience
/anatomy	Stethoscope	Interactive anatomy lab
/instruments	FlaskConical	Instrument inspection lab
/results	CircleGauge	Performance debrief
/settings	Settings	Display preferences and controls
The rail also shows the user avatar ("Dr. Maya Sharma") and the brand logo.

5. Pages In Detail
5.1 Scenario Library (/scenarios)
File: 
page.tsx

A card-grid launcher where users choose training scenarios. Features:

Search bar to filter scenarios by name, condition, or skill
Difficulty filter buttons (All / Beginner / Intermediate)
Scenario cards showing: preview image, difficulty badge, duration, skills trained, progress bar, play/lock status
Available Scenarios (from 
simulationData.ts
):

Scenario	Difficulty	Duration	Status
Forearm Laceration	Intermediate	18 min	✅ Playable
Incision Path Control	Beginner	8 min	🔒 Coming soon
Peg Transfer	Beginner	12 min	🔒 Coming soon
Needle Positioning	Intermediate	14 min	🔒 Coming soon
5.2 Simulation Room (/simulation)
File: 
page.tsx

The core experience — a 3-panel layout:


┌──────────┬──────────────────────────────┬──────────────┐
│ Patient  │      3D Viewport             │  Procedure   │
│ Panel    │  (HospitalScene / Webcam)    │  Panel       │
│          │                              │  (Steps +    │
│  Info +  │  Objective HUD               │   Checklist  │
│  Vitals  │  Suture Interaction          │   + Coach)   │
│  + Q&A   │  Camera presets              │              │
│          ├──────────────────────────────┤              │
│          │        Toolbar               │              │
└──────────┴──────────────────────────────┴──────────────┘
Key Features:

Briefing Modal — Appears before the simulation starts with case details (Case SG-2048 · Bed 04 · Forearm Laceration) and input method selection (Mouse/Touch vs Hand Tracking)
3D Virtual Patient — Full hospital scene with bed, patient model, instruments
5 Camera Presets — Room overview, Patient view, Right forearm (close-up), Instrument tray, Anatomy inspection
Objective HUD — Shows current step number, title, instruction, and progress
Suture Interaction — Draggable position track + angle slider for guided closure (7 phases)
Pause Overlay — Timer and scenario pause control
7-Step Guided Procedure:

Review patient information (confirm identity, allergies)
Inspect the wound (select right forearm)
Check distal circulation (pulse, sensation, movement)
Prepare sterile field (gloves, antiseptic, drape)
Select instruments (needle holder + forceps)
Perform simulated suturing (position → angle → stitch → pull → tie → cut)
Reassess and complete (safety check)
5.3 Anatomy Lab (/anatomy)
File: 
page.tsx
 → 
AnatomyViewer.tsx

A 3-column layout for interactive organ exploration:

Left Sidebar	Center Stage	Right Sidebar
Region buttons (Head, Thorax, Abdomen, Upper limb, Lower limb)	3D canvas with organ models	Selected structure details
Layer list (toggle visibility)	Toolbar (Wireframe, Transparency, Labels, Reset)	Color swatch, description, facts
Exploded view slider	Bottom hints (Drag to rotate, Scroll to zoom)	Training relevance, related structures
9 Anatomy Layers (from 
mockData.ts
):

Skin Layer, Muscle Layer, Rib Cage, Brain, Heart, Lungs, Kidneys, Liver, Stomach
Each layer has: id, name, color, description, relevance (to surgical training).

5.4 Instrument Lab (/instruments)
File: 
page.tsx
 → 
InstrumentViewer.tsx

Interactive 3D viewer for inspecting surgical instruments. Users can:

Select instruments from a visual list
Rotate 360° with orbit controls
Click labeled parts to learn about functional zones
Switch between instruments (Needle Holder, Forceps, Surgical Scissors, Curved Needle)
5.5 Performance Debrief (/results)
File: 
page.tsx

Post-simulation scoring dashboard:

Score Dial — Animated circular score display (0–100)
7 Metrics — Patient assessment, Procedure sequence, Instrument selection, Entry-point accuracy, Tool-angle accuracy, Movement control, Safety checks
Workflow Review — Correct actions vs. coach corrections
Event Timeline — Chronological log of all simulation events
Coach Summary — AI-generated analysis with "next focus" recommendation
Footer Actions — Retry scenario, Review anatomy, Practice instruments, Back to library
Results persist to localStorage under surgify:simulation-result.

5.6 Settings (/settings)
File: 
page.tsx

Display Preferences — Toggles for Objective guidance, Interaction overlays, High-contrast labels
User Profile — Dr. Maya Sharma, Medical Student · Intermediate
Controls Reference — Keyboard/mouse shortcuts
Safety Notice — Educational prototype disclaimer
Data Management — Clear saved results and preferences
Preferences persist to localStorage under surgify:simulation-preferences.

6. Component Architecture
6.1 Simulation Components
Located in 
frontend/components/simulation/
:

Component	File	Purpose
SimulationProvider	
SimulationProvider.tsx
Global state management via React Context
HospitalScene	
HospitalScene.tsx
R3F 3D scene — room, patient, instruments, lighting
GestureHandControl	
GestureHandControl.tsx
MediaPipe hand tracking + 3D hand proxy
WebcamPractice	
WebcamPractice.tsx
Webcam feed with overlay for practice mode
ModelRegistry	
ModelRegistry.tsx
GLB/FBX loader with procedural fallbacks
PatientPanel	
PatientPanel.tsx
Patient info, vitals, Q&A sidebar
ProcedurePanel	
ProcedurePanel.tsx
Step list, checklist, coach feedback
ToolBar	
ToolBar.tsx
Instrument/supply selection tray
SimulationTopbar	
SimulationTopbar.tsx
Timer, score, pause/resume controls
AppRail	
AppRail.tsx
Left sidebar navigation rail
6.2 Anatomy Components
Located in 
frontend/components/anatomy/
:

Component	Purpose
AnatomyViewer	3-column anatomy lab with R3F canvas, layer controls, structure info
InstrumentViewer	Instrument inspection lab with part selection
6.3 UI Primitives
Located in 
frontend/components/ui/
:

Component	Purpose
Button	Variants: primary, secondary, ghost, danger. Sizes: sm, md, lg
Badge	Toned labels (green, amber, etc.)
Card	Panel container
ProgressRing	SVG circular progress indicator
Brand	Logo component (mark + "Surgify AI" text)
7. State Management
SimulationProvider — The Brain
SimulationProvider.tsx
 manages all simulation state via React Context:

typescript

type SimulationState = {
  runStatus: "ready" | "active" | "complete";
  selectedRegion: string | null;
  selectedTool: string | null;
  currentStep: number;                // index into procedureSteps[]
  completedSteps: string[];
  completedActions: string[];
  cameraMode: CameraMode;             // "room" | "patient" | "closeup" | "webcam" | "anatomy" | "tray"
  paused: boolean;
  elapsedTime: number;                // seconds
  score: number;                      // 0–100, starts at 100, penalties deduct
  vitals: PatientVitals;              // heartRate, BP, O2, respRate, temp
  feedback: CoachMessage[];           // last 10 coach messages
  anatomyOverlay: boolean;
  trackingOverlay: boolean;
  stitchPhase: number;                // 0–6 for suture closure sequence
  suturePosition: number;             // 0–100 entry point slider
  sutureAngle: number;                // 30–85° approach angle
  events: SimulationEvent[];          // full event timeline
};
Key Actions:

startSimulation() — Transitions from briefing to active
selectRegion(region) — Validates correct body site selection
selectTool(tool) — Validates instrument selection order
performAction(action) — Master action handler with step-gated validation
setCameraMode(mode) — Switch between 6 camera presets
resetSimulation() — Return to initial state
Scoring Model: Starts at 100, with point deductions for:

Wrong region selection: −2
Out-of-sequence actions: −1 to −3
Wrong instrument: −2
Incorrect needle position/angle: warning (no deduction, must retry)
8. 3D Asset Pipeline
8.1 Model Configuration
modelConfig.ts
 is the central asset registry:

typescript

modelConfig = {
  patient:     { source: "/3d/patient.glb", alternateSource: "/3d/patient2.fbx", fallback: "FallbackPatient" },
  hospitalBed: { source: "/models/hospital-bed.glb", fallback: "FallbackHospitalBed" },
  monitor:     { source: "/models/monitor.glb", fallback: "FallbackMonitor" },
  anatomy:     { source: null, fallback: "procedural-torso" },
  instruments: { needleHolder, forceps, scissors, curvedNeedle },
  organs:      { brain, kidney, lungs, ribCage, heart, muscle, liver, stomach },
}
8.2 Asset Inventory
3D Models in frontend/public/3d/:

Asset	File	Size
Patient (primary)	patient.glb	296 KB
Patient (alternate)	patient2.fbx	8.8 MB
Hand proxy	hand.glb	26 MB
Arms	ArmsPayDayHigh.fbx	366 KB
Instruments (public/3d/Instruments/):

Instrument	Size
Needle Holder	3.7 MB
Forceps	3.9 MB
Surgical Scissors	3.8 MB
Curved Needle	1.5 MB
Organs (public/3d/Organs/):

Organ	Size	Color
Brain	867 KB	#d9a6a6
Heart	800 KB	#c94755
Lungs	704 KB	#e58f9b
Kidneys	882 KB	#984d46
Rib Cage	369 KB	#e9e1ca
Liver	1.9 MB	#7f352f
Stomach	1.4 MB	#c48674
Muscle	621 KB	#b64953
8.3 Model Loading Strategy
ModelRegistry.tsx
 implements:

SafeMedicalGLB — GLB loader with automatic scaling, texture preservation, and clinical material fallback
MedicalFBX — FBX loader via Three.js FBXLoader
ModelErrorBoundary — React error boundary rendering procedural fallback geometry
Procedural fallback components (FallbackPatient, FallbackHospitalBed, etc.) for offline reliability
8.4 3D Asset Attribution
"Patient" by edouard77 — CC BY 4.0
"Realistic Human Heart" by neshallads — CC BY 4.0
9. Hand Tracking System
9.1 Overview
The hand tracking pipeline runs entirely in-browser using Google MediaPipe:

Camera → MediaPipe GestureRecognizer → 21 3D Landmarks → palmPose() → Spring Physics → 3D Hand Proxy
9.2 Components
HandTrackingDriver (
GestureHandControl.tsx
):

Runs outside the R3F canvas (DOM side)
Captures webcam at 640×480, processes every frame
Publishes detected hands into a shared handStore
Draws skeleton overlay on a picture-in-picture panel
Detects pinch gestures and sustained open palms (tool release)
GestureHand (R3F side):

Renders two TrackedGLBHand instances (Left + Right)
Loads hand.glb, clones per-side via SkeletonUtils
Uses spring-damper physics for smooth motion (170 stiffness, 26 damping)
9.3 Hand Physics
handPhysics.mjs
 provides:

palmPose(hand) — Converts 21 MediaPipe landmarks to world-space position + palm orientation
fingerCurls(landmarks) — Per-finger curl values 0 (straight) → 1 (folded)
springStep(state, target, dt) — Semi-implicit spring-damper for smooth motion
damp(rate, dt) — Frame-rate-independent smoothing factor
Workspace mapping:

X: [-2.3, 2.3] across the hospital bed
Z: [-2.5, 1.9] along the patient (head → feet)
Y: 1.74 (floor) to 2.4 (hover), mapped from apparent hand size in the camera
10. Design System
10.1 CSS Variables
Defined in 
globals.css
:

css

--bg:            #07101b        /* Deep navy background */
--panel:         #0d1926        /* Panel background */
--panel-2:       #122235        /* Elevated panel */
--panel-3:       #182b3e        /* Highest elevation */
--cyan:          #36b8c8        /* Primary accent */
--cyan-bright:   #7bdde6        /* Bright accent */
--blue:          #477fc4        /* Secondary accent */
--green:         #3ebd74        /* Success */
--amber:         #e2a94c        /* Warning */
--red:           #df5965        /* Error/danger */
--text:          #ecf2f6        /* Primary text */
--muted:         #8498aa        /* Muted text */
--border:        rgba(143,165,183,.18)    /* Default border */
--border-strong: rgba(83,194,206,.38)     /* Emphasized border */
10.2 Typography
Primary: Geist Sans (system-like, clean)
Monospace: Geist Mono (timers, code, metrics)
Display: Manrope (headings, emphasis)
10.3 Design Language
Dark mode first — Deep navy background with clinical precision aesthetics
Glassmorphism panels — backdrop-filter: blur(), inner shadows, border glow
Micro-animations — fadeIn, pulse-glow, float-status, color-shift keyframes
Medical palette — Cyan primary (surgical precision), green (success/vitals), amber (warnings), red (errors)
11. Backend Integration
11.1 API Contract
Base URL: http://localhost:8000/api/v1 WebSocket: ws://localhost:8000/ws/sessions/{session_id}

Environment variables:


NEXT_PUBLIC_SURGIFY_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_SURGIFY_WS_URL=ws://localhost:8000
11.2 Backend Architecture

backend/app/
├── main.py               FastAPI app, CORS, error envelope
├── config.py             pydantic-settings (env-driven)
├── database.py           SQLAlchemy engine (SQLite)
├── models.py             DB tables (sessions, events, results, coach, trajectory)
├── schemas.py            Pydantic request/response models
├── api/                  Routers: catalog, sessions, results, vision, websocket
└── services/
    ├── simulation_engine.py    Pure functional core + imperative persistence
    ├── scoring_engine.py       Weighted 0–100 scoring
    ├── coaching_engine.py      Deterministic rule-based coach
    ├── vitals.py               Mock vitals drift
    ├── vision.py               Mock / OpenCV / MediaPipe adapters
    └── websocket_manager.py    Per-session broadcast + cleanup
11.3 Vision Modes
Mode	Description
mediapipe (default)	MediaPipe landmarks, handedness, gestures, pinch detection
mock	Deterministic pseudo-detections for no-camera environments
opencv	ArUco-marker + HSV color-marker tool-tip detection
11.4 Demo Workflow
GET /scenarios → pick forearm-laceration
POST /sessions → POST /sessions/{id}/start → open WebSocket
Submit events per step → coach + vitals + metrics stream live
Final step auto-generates result → GET /sessions/{id}/results
12. Data Models
12.1 Core Types
From 
types/simulation.ts
:

typescript

type CameraMode = "room" | "patient" | "closeup" | "webcam" | "anatomy" | "tray";
type PatientVitals = {
  heartRate: number; systolic: number; diastolic: number;
  oxygenSaturation: number; respiratoryRate: number; temperature: number;
};
type CoachMessage = {
  id: string; tone: "info" | "success" | "warning" | "error";
  title: string; message: string; timestamp: number;
};
type SimulationEvent = {
  id: string; timestamp: number; tone: CoachMessage["tone"]; label: string;
};
12.2 Mock Data
From 
mockData.ts
:

scenarios[] — 4 training scenarios (incision, peg-transfer, needle-positioning, simple-suture)
recentSessions[] — 4 mock training sessions with scores and metrics
skillData[] — 5 skill categories with proficiency values
trendData[] — 8-week score/time trend
comparisonData[] — Current vs. previous vs. best scores
anatomyLayers[] — 9 body structures with descriptions and relevance
12.3 Simulation Data
From 
simulationData.ts
:

procedureSteps[] — 7 guided procedure steps (review → identify → assess → prepare → instruments → suture → complete)
checklistItems[] — 7 safety checklist items
scenarioTiles[] — 4 scenario cards with images and metadata
patientAnswers — 5 pre-scripted patient Q&A responses
13. Persistence & Storage
Data	Storage	Key
Simulation results	localStorage	surgify:simulation-result
User preferences	localStorage	surgify:simulation-preferences
Session data	Backend SQLite	Via API
All frontend state is device-local — no accounts, no cloud sync in the prototype.

14. Build & Deployment
14.1 Build System
Vite 8 + vinext — Custom Next.js-compatible Vite integration
Cloudflare Workers — Edge deployment target via @cloudflare/vite-plugin
Turbopack — Used by Next.js for optimized production builds
14.2 Key Configuration Files
File	Purpose
vite.config.ts
Vite + Cloudflare Workers + vinext setup
package.json
Dependencies, scripts, Node ≥22.13.0
tsconfig.json
TypeScript configuration
drizzle.config.ts
Drizzle ORM database schema generation
Makefile
Orchestration (install, dev, seed, smoke)
14.3 Scripts
json

{
  "dev":   "vinext dev",
  "build": "vinext build",
  "start": "vinext start",
  "test":  "npm run build && node --test tests/rendered-html.test.mjs",
  "lint":  "eslint .",
  "db:generate": "drizzle-kit generate"
}
15. Testing
Rendered HTML Tests — tests/rendered-html.test.mjs runs after build to validate page output
Backend Smoke Test — scripts/smoke_check.py drives the full forearm-laceration flow end-to-end
No unit test framework beyond Node's built-in --test runner
16. Known Prototype Limitations
No authentication — Anonymous sessions; user_id is nullable
No database migrations — Uses create_all + seed script (hackathon approach)
MediaPipe depends on lighting — Mouse controls remain available as fallback
Vitals are cosmetic — Drift animation, not a physiological model
Elapsed time is client-reported — Clamped server-side but trusted
Single-instance WebSocket — In-memory fan-out, no Redis
Only one playable scenario — Forearm Laceration; others show "Coming soon"
17. SEO & Open Graph
html

<title>Surgify AI — Surgical skills training</title>
<meta name="description" content="An immersive virtual patient environment for simulated clinical and surgical skills training." />
<meta property="og:image" content="/og-simulation.png" />
Open Graph images are in frontend/public/: og.png (1.7 MB) and og-simulation.png (1.9 MB).

18. File Map Reference

frontend/
├── app/
│   ├── layout.tsx                    Root layout (fonts, metadata, OG)
│   ├── page.tsx                      Landing → redirect to /scenarios
│   ├── globals.css                   Design system variables + base styles
│   └── (app)/
│       ├── layout.tsx                SimulationProvider + AppRail wrapper
│       ├── shell.css                 App shell layout
│       ├── clinical-light.css        Clinical UI component styles
│       ├── anatomy/page.tsx          Interactive anatomy lab
│       ├── instruments/page.tsx      Instrument inspection lab
│       ├── results/page.tsx          Performance debrief
│       ├── scenarios/page.tsx        Scenario library
│       ├── settings/page.tsx         User preferences
│       └── simulation/page.tsx       3D simulation room
├── components/
│   ├── anatomy/
│   │   ├── AnatomyViewer.tsx         3-column anatomy viewer
│   │   └── InstrumentViewer.tsx      Instrument inspection viewer
│   ├── simulation/
│   │   ├── SimulationProvider.tsx    Global state management
│   │   ├── HospitalScene.tsx         R3F 3D hospital scene
│   │   ├── GestureHandControl.tsx    MediaPipe hand tracking
│   │   ├── WebcamPractice.tsx        Webcam practice mode
│   │   ├── ModelRegistry.tsx         GLB/FBX asset loader
│   │   ├── PatientPanel.tsx          Patient sidebar
│   │   ├── ProcedurePanel.tsx        Procedure sidebar
│   │   ├── ToolBar.tsx               Instrument selection
│   │   ├── SimulationTopbar.tsx      Timer + score bar
│   │   └── AppRail.tsx               Navigation sidebar
│   └── ui/
│       ├── Badge.tsx                 Label component
│       ├── Brand.tsx                 Logo component
│       ├── Button.tsx                Button variants
│       ├── Card.tsx                  Panel container
│       └── ProgressRing.tsx          SVG circular progress
├── data/
│   ├── mockData.ts                   Scenarios, sessions, anatomy, analytics
│   ├── simulationData.ts            Procedure steps, checklist, patient Q&A
│   └── modelConfig.ts               3D model registry
├── lib/
│   ├── handPhysics.mjs              Palm pose, finger curls, spring physics
│   └── utils.ts                     Utility functions (cn, formatTime)
├── types/
│   └── simulation.ts                TypeScript type definitions
├── public/
│   ├── 3d/                          GLB/FBX 3D models
│   ├── images/scenarios/            Scenario preview images
│   └── mediapipe/                   MediaPipe WASM + model files
└── tests/
    └── rendered-html.test.mjs       Post-build HTML validation