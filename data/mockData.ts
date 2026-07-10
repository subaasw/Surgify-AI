import type { AnatomyLayer, Scenario, TrainingSession } from "@/types";

export const scenarios: Scenario[] = [
  {
    id: "incision",
    name: "Incision Path Tracing",
    difficulty: "Beginner",
    description: "Follow a marked path while maintaining consistent pressure and control.",
    duration: 8,
    skills: ["Tool control", "Stability", "Path accuracy"],
    progress: 84,
  },
  {
    id: "peg-transfer",
    name: "Peg Transfer",
    difficulty: "Beginner",
    description: "Build confident bimanual coordination through precise object transfer.",
    duration: 12,
    skills: ["Bimanual coordination", "Object transfer", "Motion efficiency"],
    progress: 62,
  },
  {
    id: "needle-positioning",
    name: "Needle Positioning",
    difficulty: "Intermediate",
    description: "Orient a curved needle at the correct approach angle before entry.",
    duration: 15,
    skills: ["Needle angle", "Instrument handling", "Precision"],
    progress: 48,
  },
  {
    id: "suture",
    name: "Simple Interrupted Suture",
    difficulty: "Advanced",
    description: "Complete an accurate interrupted stitch from entry through knot sequence.",
    duration: 20,
    skills: ["Entry accuracy", "Exit symmetry", "Stitch spacing", "Knot sequence"],
    progress: 71,
  },
];

export const recentSessions: TrainingSession[] = [
  {
    id: "S-2408",
    scenarioId: "suture",
    date: "Today, 08:42",
    score: 78,
    duration: 223,
    metrics: { accuracy: 80, efficiency: 72, stability: 79, sequence: 84, safety: 88, completionTime: 223 },
    mistakes: [],
  },
  {
    id: "S-2407",
    scenarioId: "needle-positioning",
    date: "Yesterday, 16:10",
    score: 86,
    duration: 182,
    metrics: { accuracy: 88, efficiency: 82, stability: 84, sequence: 89, safety: 91, completionTime: 182 },
    mistakes: [],
  },
  {
    id: "S-2406",
    scenarioId: "peg-transfer",
    date: "08 Jul, 10:23",
    score: 83,
    duration: 315,
    metrics: { accuracy: 81, efficiency: 80, stability: 86, sequence: 83, safety: 91, completionTime: 315 },
    mistakes: [],
  },
  {
    id: "S-2405",
    scenarioId: "incision",
    date: "06 Jul, 14:05",
    score: 81,
    duration: 128,
    metrics: { accuracy: 84, efficiency: 75, stability: 80, sequence: 82, safety: 90, completionTime: 128 },
    mistakes: [],
  },
];

export const skillData = [
  { skill: "Accuracy", value: 84 },
  { skill: "Motion efficiency", value: 76 },
  { skill: "Stability", value: 81 },
  { skill: "Procedure sequence", value: 88 },
  { skill: "Safety compliance", value: 92 },
];

export const trendData = [
  { week: "W1", score: 64, minutes: 35 },
  { week: "W2", score: 68, minutes: 48 },
  { week: "W3", score: 67, minutes: 42 },
  { week: "W4", score: 73, minutes: 60 },
  { week: "W5", score: 76, minutes: 72 },
  { week: "W6", score: 78, minutes: 58 },
  { week: "W7", score: 80, minutes: 86 },
  { week: "W8", score: 82, minutes: 94 },
];

export const comparisonData = [
  { skill: "Accuracy", current: 84, previous: 76, best: 91 },
  { skill: "Efficiency", current: 76, previous: 72, best: 86 },
  { skill: "Stability", current: 81, previous: 77, best: 88 },
  { skill: "Sequence", current: 88, previous: 80, best: 92 },
  { skill: "Safety", current: 92, previous: 90, best: 96 },
];

export const anatomyLayers: AnatomyLayer[] = [
  {
    id: "skin",
    name: "Skin Layer",
    color: "#d7a887",
    description: "The skin is the first anatomical layer encountered during many basic surgical procedures.",
    relevance: "Incision tracing and suturing exercises develop precision and tissue-respect principles.",
  },
  {
    id: "muscles",
    name: "Muscle Layer",
    color: "#b94c55",
    description: "Skeletal muscle is organized in directional fibres that influence safe dissection planes.",
    relevance: "Path planning exercises reinforce controlled depth and directional awareness.",
  },
  {
    id: "skeleton",
    name: "Rib Cage",
    color: "#e8e0c8",
    description: "The ribs protect thoracic organs and provide essential surface landmarks.",
    relevance: "Landmark identification supports safe tool positioning in thoracic simulations.",
  },
  {
    id: "brain",
    name: "Brain",
    color: "#d9a6a6",
    description: "The brain is the central organ of the nervous system, protected by the skull.",
    relevance: "Spatial inspection reinforces protected-zone awareness and neurological orientation.",
  },
  {
    id: "heart",
    name: "Heart",
    color: "#d63c53",
    description: "The heart is a muscular organ positioned centrally within the thoracic cavity.",
    relevance: "Spatial visualization builds anatomy awareness before supervised skills practice.",
  },
  {
    id: "lungs",
    name: "Lungs",
    color: "#ea8f9c",
    description: "Paired lungs occupy most of the thoracic cavity on either side of the mediastinum.",
    relevance: "Layer toggles clarify how surface landmarks relate to protected structures.",
  },
  {
    id: "kidney",
    name: "Kidneys",
    color: "#984d46",
    description: "The paired kidneys lie behind the abdominal cavity on either side of the spine.",
    relevance: "Posterior positioning and paired anatomy support regional orientation exercises.",
  },
  {
    id: "liver",
    name: "Liver",
    color: "#8e3e36",
    description: "The liver occupies the right upper abdomen beneath the diaphragm.",
    relevance: "Regional exploration supports basic orientation and safe-zone awareness.",
  },
  {
    id: "stomach",
    name: "Stomach",
    color: "#c58d79",
    description: "The stomach is a hollow organ in the upper left abdominal region.",
    relevance: "Understanding relative organ position supports procedural sequence learning.",
  },
];

export const medicalDisclaimer =
  "Surgify AI is an educational prototype for simulated skills training. It is not intended for real-patient use, diagnosis, clinical decision-making, or certification of surgical competence.";
