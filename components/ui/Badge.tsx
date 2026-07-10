import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Badge({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "amber" | "red" | "slate" }) {
  return <span className={cn("badge", `badge-${tone}`)}>{children}</span>;
}
