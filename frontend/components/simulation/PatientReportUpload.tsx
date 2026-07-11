"use client";

import { useRef, useState, type DragEvent } from "react";
import { AlertCircle, CheckCircle2, FileImage, LoaderCircle, UploadCloud } from "lucide-react";

type OcrResponse = { extracted_name: string | null; raw_text: string; error: string | null };

export function PatientReportUpload({ onNameExtracted }: { onNameExtracted: (name: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("Drop a medical report image here or choose a file");

  const scan = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setStatus("error"); setMessage("Please choose an image file."); return; }
    if (file.size > 10 * 1024 * 1024) { setStatus("error"); setMessage("Image must be smaller than 10 MB."); return; }
    setStatus("loading");
    setMessage("Scanning report...");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("http://localhost:8000/api/v1/patient/extract-name", { method: "POST", body });
      const result = await response.json() as OcrResponse;
      if (!response.ok || result.error) throw new Error(result.error || "Report scanning failed.");
      const name = result.extracted_name?.trim();
      if (!name) throw new Error("No patient name was found in this report.");
      onNameExtracted(name);
      setStatus("success");
      setMessage(`${name} · extracted from ${file.name}`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not scan this report.");
    } finally {
      if (input.current) input.current.value = "";
    }
  };

  const drop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    if (status !== "loading") void scan(event.dataTransfer.files[0]);
  };

  return <div className={`patient-report-upload ${status}`}>
    <label onDragOver={event => event.preventDefault()} onDrop={drop} htmlFor="patient-report-file">
      <input ref={input} id="patient-report-file" type="file" accept="image/*" disabled={status === "loading"} onChange={event => void scan(event.target.files?.[0])} />
      <span>{status === "loading" ? <LoaderCircle className="spin" size={20} /> : status === "success" ? <CheckCircle2 size={20} /> : status === "error" ? <AlertCircle size={20} /> : <UploadCloud size={20} />}</span>
      <div><strong>{status === "loading" ? "Scanning report..." : status === "success" ? "Patient identified" : "Upload patient case report"}</strong><small>{message}</small></div>
      {status === "idle" && <FileImage size={16} />}
    </label>
  </div>;
}
