"use client";

import { useEffect, useState } from "react";
import { Bell, Camera, Check, Contrast, Database, Moon, ShieldCheck, Sparkles } from "lucide-react";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import "./settings.css";

const options = [{key:"guidance",title:"AI coaching prompts",text:"Show simulated guidance during training sessions",icon:Sparkles},{key:"overlays",title:"Tracking overlays",text:"Display landmarks, tool path, and target zones by default",icon:Camera},{key:"notifications",title:"Practice reminders",text:"Show in-app reminders for planned practice sessions",icon:Bell},{key:"contrast",title:"High-contrast metrics",text:"Increase distinction between chart series and progress states",icon:Contrast}];

export default function SettingsPage(){
 const [prefs,setPrefs]=useState<Record<string,boolean>>({guidance:true,overlays:true,notifications:true,contrast:false});
 const [saved,setSaved]=useState(false);
 useEffect(()=>{try{const stored=localStorage.getItem("surgify:preferences");if(stored)setPrefs(JSON.parse(stored));}catch{}},[]);
 const save=()=>{try{localStorage.setItem("surgify:preferences",JSON.stringify(prefs));localStorage.setItem("surgify:theme","dark");}catch{}setSaved(true);setTimeout(()=>setSaved(false),1800)};
 return <div className="page-wrap settings-page"><DashboardHeader title="Settings" description="Adjust how the prototype presents guidance, overlays, and learning reminders."/><div className="settings-grid"><section><Card className="settings-card"><div className="settings-heading"><span><Moon size={18}/></span><div><h2>Training experience</h2><p>Preferences are stored locally on this device.</p></div></div><div className="preference-list">{options.map(({key,title,text,icon:Icon})=><label key={key}><span className="preference-icon"><Icon size={16}/></span><div><strong>{title}</strong><small>{text}</small></div><button type="button" role="switch" aria-checked={prefs[key]} className={prefs[key]?"switch on":"switch"} onClick={()=>setPrefs(p=>({...p,[key]:!p[key]}))}><i/></button></label>)}</div><Button onClick={save}>{saved?<><Check size={15}/>Preferences saved</>:"Save preferences"}</Button></Card></section><aside><Card className="profile-card"><div className="settings-avatar">MS</div><h2>Dr. Maya Sharma</h2><p>Medical Student · Intermediate</p><div><span>Training level<strong>Level 3</strong></span><span>Practice streak<strong>7 days</strong></span></div></Card><Card className="privacy-card"><ShieldCheck size={18}/><div><strong>Prototype privacy</strong><p>No account, real patient data, or training video is uploaded. Demo preferences remain in local browser storage.</p></div></Card><Card className="data-card"><Database size={18}/><div><strong>Reset local data</strong><p>Clear simulated scores, streaks, and saved preferences.</p><button onClick={()=>{try{Object.keys(localStorage).filter(k=>k.startsWith("surgify:")).forEach(k=>localStorage.removeItem(k));}catch{}}}>Clear prototype data</button></div></Card></aside></div></div>;
}
