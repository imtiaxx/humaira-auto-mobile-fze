import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-neutral-surface text-neutral",
  success: "bg-success-surface text-success",
  warning: "bg-warning-surface text-warning",
  danger: "bg-danger-surface text-danger",
  info: "bg-info-surface text-info",
  accent: "bg-accent-100 text-accent-800",
};

/**
 * Small status pill.
 *
 * Used for vehicle condition, enquiry state and system status. Tone pairs come
 * from the semantic tokens in `globals.css`, so a badge never hard-codes a
 * colour and stays legible in both colour schemes.
 */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 text-xs font-medium tracking-wide uppercase",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
