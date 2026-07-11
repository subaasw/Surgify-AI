"use client";

import { useState } from "react";
import { Activity, ChevronLeft, ChevronRight, HeartPulse, MessageCircle, ShieldCheck, Thermometer, UserRound } from "lucide-react";
import { useSimulation } from "./SimulationProvider";
import { patientAnswers } from "@/data/simulationData";

const questions = Object.keys(patientAnswers);

export function PatientPanel() {
  const [panel,setPanel]=useState({step:-1,collapsed:false});
  const [answer,setAnswer]=useState("The pain is around my forearm, and my thumb feels numb.");
  const { state, performAction }=useSimulation();
  const v=state.vitals;
  const collapsed=panel.step===state.currentStep?panel.collapsed:state.uiCollapsed;
  return <aside className={collapsed?"patient-panel collapsed":"patient-panel"}><button className="panel-collapse patient-collapse" onClick={()=>setPanel({step:state.currentStep,collapsed:!collapsed})} aria-label={collapsed?"Expand patient panel":"Collapse patient panel"}>{collapsed?<ChevronRight size={14}/>:<ChevronLeft size={14}/>}</button>{collapsed?<div className="collapsed-panel-icon"><UserRound size={17}/><span>PATIENT</span></div>:<><div className="patient-identity"><div className="patient-avatar"><UserRound size={20}/><i/></div><div><span>Patient</span><strong>Alex Morgan</strong><small>28 years · Male</small></div><b>SG-2048</b></div><div className="clinical-summary"><div className="patient-section-label"><Activity size={13}/>Clinical summary</div><dl><div><dt>Chief complaint</dt><dd>Deep forearm laceration with thumb-index numbness</dd></div><div><dt>Mechanism</dt><dd>Accidental cut from a sharp metal object</dd></div><div><dt>Status</dt><dd><span className="status-dot"/>Stable</dd></div></dl><button onClick={()=>performAction("Review patient information")} className={state.completedSteps.includes("review")?"review-button complete":"review-button"}><ShieldCheck size={13}/>{state.completedSteps.includes("review")?"Patient reviewed":"Confirm patient review"}</button></div><div className="vitals-section"><div className="patient-section-label"><HeartPulse size={13}/>Vital signs <span><i/>Live</span></div><div className="ecg-strip"><i/><span/><span/><span/></div><div className="vitals-grid"><Vital label="HR" value={`${v.heartRate}`} unit="bpm" tone="green"/><Vital label="BP" value={`${v.systolic}/${v.diastolic}`} unit="mmHg"/><Vital label="SpO₂" value={`${v.oxygenSaturation}`} unit="%" tone="blue"/><Vital label="RR" value={`${v.respiratoryRate}`} unit="/min"/><Vital label="Temp" value={v.temperature.toFixed(1)} unit="°C" icon={<Thermometer size={11}/>} /></div></div><div className="communication-section"><div className="patient-section-label"><MessageCircle size={13}/>Patient communication</div><div className="patient-answer"><span>Patient says:</span><p>“{answer}”</p></div><div className="question-list">{questions.map(q=><button key={q} onClick={()=>{setAnswer(patientAnswers[q]);if(q==="Do you have allergies?")performAction("Check allergies")}}>{q}</button>)}</div></div><div className="patient-panel-disclaimer">Fictional patient · Educational simulation only</div></>}</aside>;
}

function Vital({label,value,unit,tone,icon}:{label:string;value:string;unit:string;tone?:string;icon?:React.ReactNode}){return <div className={`vital-cell ${tone??""}`}><div><span>{label}</span>{icon}</div><strong>{value}</strong><small>{unit}</small></div>}
