export const procedureSteps = [
  { id: "review", title: "Review patient information", instruction: "Confirm the patient identity, complaint, mechanism, and allergy status.", hint: "Use the patient panel before examining the injury." },
  { id: "identify", title: "Inspect the wound", instruction: "Select the injured right forearm directly on the patient.", hint: "The patient reports pain around the right forearm." },
  { id: "assess", title: "Check distal circulation", instruction: "Check pulse, sensation, and finger movement before preparing the field.", hint: "Assessment should precede wound closure." },
  { id: "prepare", title: "Prepare sterile field", instruction: "Apply gloves, cleanse the synthetic patch, and place a sterile drape.", hint: "Select preparation supplies from the toolbar." },
  { id: "instruments", title: "Select instruments", instruction: "Choose the needle holder and forceps for the guided exercise.", hint: "The needle holder is the primary active tool." },
  { id: "suture", title: "Perform simulated suturing", instruction: "Position the tool, match the target angle, and follow the guided arc.", hint: "Recommended approach angle: 45°–60°." },
  { id: "complete", title: "Reassess and complete", instruction: "Finish the knot, cut the suture, and complete the safety check.", hint: "Review the stitch before ending the scenario." },
] as const;

export const checklistItems = [
  { id: "review", label: "Patient identity confirmed" },
  { id: "allergy", label: "Allergy status checked" },
  { id: "identify", label: "Correct site selected" },
  { id: "prepare", label: "Sterile preparation completed" },
  { id: "instruments", label: "Correct instrument selected" },
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
