import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
};

export function Button({ className, variant = "primary", size = "md", children, ...props }: ButtonProps) {
  return <button className={cn("button", `button-${variant}`, `button-${size}`, className)} {...props}>{children}</button>;
}

export function ButtonLink({ href, className, variant = "primary", size = "md", children }: {
  href: string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  children: ReactNode;
}) {
  return <Link href={href} className={cn("button", `button-${variant}`, `button-${size}`, className)}>{children}</Link>;
}
