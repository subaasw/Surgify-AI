export const procedureSteps = [
  { id: "review", title: "Verify the case", instruction: "Confirm patient identity, injury history, and allergy status.", hint: "Ask about allergies, then confirm the review in the patient panel." },
  { id: "identify", title: "Identify the procedure site", instruction: "Inspect the patient and select the injured right forearm.", hint: "Use the reported pain location to identify the correct site." },
  { id: "assess", title: "Complete the neurovascular check", instruction: "Check distal pulse, sensation, and finger movement.", hint: "Document all three findings before preparing the field." },
  { id: "prepare", title: "Establish the sterile field", instruction: "Apply gloves, cleanse the virtual forearm, and place a sterile drape.", hint: "The action dock shows only the required preparation items." },
  { id: "instruments", title: "Prepare microsurgical instruments", instruction: "Physically pick up the needle holder and forceps from the 3D tray.", hint: "Pinch each handle, lift it, then release it back onto the tray." },
  { id: "incision", title: "Expose the injured nerve", instruction: "Hold the scalpel and trace the guide through direct blade-tip contact.", hint: "Start at the first marker; only correct surface contact changes the skin layer." },
  { id: "suture", title: "Repair the divided nerve", instruction: "Use forceps, needle holder, and scissors directly on the exposed nerve.", hint: "Every phase is completed by tracked tool movement—there are no action buttons." },
  { id: "complete", title: "Inspect the nerve repair", instruction: "Release the instruments and approve the completed repair with a thumbs-up.", hint: "The scenario finishes only after the tracked approval gesture." },
] as const;

export const stitchActions = ["Align nerve ends", "Set repair angle", "Pass repair stitch", "Pull microsuture", "Tie repair knot", "Cut microsuture"] as const;

export const stitchPhaseLabels = ["Approximate nerve ends", "Set microsuture approach", "Pass epineurial stitch", "Pull microsuture through", "Secure repair knot", "Trim microsuture", "Review nerve repair"] as const;

export const checklistItems = [
  { id: "review", label: "Patient identity confirmed" },
  { id: "allergy", label: "Allergy status checked" },
  { id: "identify", label: "Correct site selected" },
  { id: "prepare", label: "Sterile preparation completed" },
  { id: "instruments", label: "Correct instrument selected" },
  { id: "incision", label: "Nerve exposed" },
  { id: "suture", label: "Nerve repair completed" },
  { id: "safety", label: "Safety check completed" },
  { id: "complete", label: "Procedure completed" },
] as const;

export const scenarioTiles = [
  { id: "forearm", name: "Forearm Nerve Repair", image: "/images/scenarios/forearm-laceration.jpg", condition: "Patient assessment and guided nerve approximation", difficulty: "Intermediate", duration: 18, skills: ["Assessment", "Nerve exposure", "Microsuture repair"], progress: 0, status: "Ready", playable: true },
  { id: "incision", name: "Incision Path Control", image: "/images/scenarios/incision-path-control.jpg", condition: "Tool stability and precision", difficulty: "Beginner", duration: 8, skills: ["Path accuracy", "Pressure control", "Stability"], progress: 0, status: "Coming soon", playable: false },
  { id: "peg", name: "Peg Transfer", image: "/images/scenarios/peg-transfer.jpg", condition: "Bimanual coordination", difficulty: "Beginner", duration: 12, skills: ["Coordination", "Object transfer", "Efficiency"], progress: 0, status: "Coming soon", playable: false },
  { id: "needle", name: "Needle Positioning", image: "/images/scenarios/needle-positioning.jpg", condition: "Instrument and needle control", difficulty: "Intermediate", duration: 14, skills: ["Needle angle", "Grip control", "Precision"], progress: 0, status: "Coming soon", playable: false },
];

export const patientAnswers: Record<string, string> = {
  "Where is the pain?": "The pain is mostly around my right forearm, near the cut.",
  "Do you have allergies?": "I have no known medication or latex allergies.",
  "When did the injury occur?": "About forty minutes ago while I was moving a metal shelf.",
  "Can you move your fingers?": "I can move them, but my thumb feels weaker than usual.",
  "Do you feel numbness?": "Yes. My thumb and index finger feel numb and tingly.",
};
