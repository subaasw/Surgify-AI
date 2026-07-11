export const procedureSteps = [
  { id: "review", title: "Verify the case", instruction: "Confirm patient identity, injury history, and allergy status.", hint: "Ask about allergies, then confirm the review in the patient panel." },
  { id: "identify", title: "Identify the procedure site", instruction: "Inspect the patient and select the injured right forearm.", hint: "Use the reported pain location to identify the correct site." },
  { id: "assess", title: "Complete the neurovascular check", instruction: "Check distal pulse, sensation, and finger movement.", hint: "Document all three findings before preparing the field." },
  { id: "prepare", title: "Establish the sterile field", instruction: "Apply gloves, cleanse the virtual forearm, and place a sterile drape.", hint: "The action dock shows only the required preparation items." },
  { id: "instruments", title: "Prepare closure instruments", instruction: "Confirm the needle holder and forceps before the hands-on exercise.", hint: "Select both instruments; the needle holder remains active." },
  { id: "incision", title: "Create the guided incision", instruction: "Use the scalpel to trace the guide directly on the virtual patient's forearm.", hint: "The layered virtual patient remains educational and non-graphic." },
  { id: "suture", title: "Place one interrupted suture", instruction: "Align, match the angle, pass the needle, pull through, tie, and trim.", hint: "Complete the guided phases in order; the scene responds to each phase." },
  { id: "complete", title: "Reassess and finish", instruction: "Inspect approximation, confirm safety, and complete the scenario.", hint: "Finish only after the knot is secure and the suture is trimmed." },
] as const;

export const stitchActions = ["Position instrument", "Match angle", "Begin stitch", "Pull suture", "Tie knot", "Cut suture"] as const;

export const stitchPhaseLabels = ["Align entry", "Set approach", "Needle passage", "Pull through", "Secure knot", "Trim tails", "Review stitch"] as const;

export const checklistItems = [
  { id: "review", label: "Patient identity confirmed" },
  { id: "allergy", label: "Allergy status checked" },
  { id: "identify", label: "Correct site selected" },
  { id: "prepare", label: "Sterile preparation completed" },
  { id: "instruments", label: "Correct instrument selected" },
  { id: "incision", label: "Incision completed" },
  { id: "safety", label: "Safety check completed" },
  { id: "complete", label: "Procedure completed" },
] as const;

export const scenarioTiles = [
  { id: "forearm", name: "Forearm Laceration", image: "/images/scenarios/forearm-laceration.jpg", condition: "Patient assessment and basic wound closure", difficulty: "Intermediate", duration: 18, skills: ["Assessment", "Sterile preparation", "Guided suturing"], progress: 0, status: "Ready", playable: true },
  { id: "incision", name: "Incision Path Control", image: "/images/scenarios/incision-path-control.jpg", condition: "Tool stability and precision", difficulty: "Beginner", duration: 8, skills: ["Path accuracy", "Pressure control", "Stability"], progress: 0, status: "Coming soon", playable: false },
  { id: "peg", name: "Peg Transfer", image: "/images/scenarios/peg-transfer.jpg", condition: "Bimanual coordination", difficulty: "Beginner", duration: 12, skills: ["Coordination", "Object transfer", "Efficiency"], progress: 0, status: "Coming soon", playable: false },
  { id: "needle", name: "Needle Positioning", image: "/images/scenarios/needle-positioning.jpg", condition: "Instrument and needle control", difficulty: "Intermediate", duration: 14, skills: ["Needle angle", "Grip control", "Precision"], progress: 0, status: "Coming soon", playable: false },
];

export const patientAnswers: Record<string, string> = {
  "Where is the pain?": "The pain is mostly around my right forearm, near the cut.",
  "Do you have allergies?": "I have no known medication or latex allergies.",
  "When did the injury occur?": "About forty minutes ago while I was moving a metal shelf.",
  "Can you move your fingers?": "Yes. It hurts slightly, but I can move all of my fingers.",
  "Do you feel numbness?": "No numbness or tingling. Sensation feels normal.",
};
