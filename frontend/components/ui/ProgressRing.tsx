import { cn } from "@/lib/utils";

export function ProgressRing({ value, label, size = "md", tone = "cyan" }: {
  value: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  tone?: "cyan" | "green" | "amber";
}) {
  const r = size === "lg" ? 44 : size === "md" ? 34 : 25;
  const dim = r * 2 + 12;
  const circ = 2 * Math.PI * r;
  return (
    <div className={cn("progress-ring-wrap", `progress-ring-${size}`)}>
      <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} aria-hidden="true">
        <circle className="progress-ring-track" cx={dim / 2} cy={dim / 2} r={r} />
        <circle className={cn("progress-ring-value", `ring-${tone}`)} cx={dim / 2} cy={dim / 2} r={r}
          strokeDasharray={circ} strokeDashoffset={circ - (value / 100) * circ} />
      </svg>
      <span className="progress-ring-number">{Math.round(value)}<small>%</small></span>
      {label && <span className="progress-ring-label">{label}</span>}
    </div>
  );
}
