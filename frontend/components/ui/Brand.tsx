import Link from "next/link";
import { cn } from "@/lib/utils";

export function Brand({ compact = false, href = "/" }: { compact?: boolean; href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="Surgify AI home">
      <span className="brand-mark" aria-hidden="true" />
      <span className={cn("brand-name", compact && "sr-only")}>Surgify <strong>AI</strong></span>
    </Link>
  );
}
