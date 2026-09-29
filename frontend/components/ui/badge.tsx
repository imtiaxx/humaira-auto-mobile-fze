import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";
export type BadgeSize = "sm" | "md";

/**
 * Badge tone pairings.
 *
 * The five status tones are semantic pairs, so they resolve correctly against
 * whichever canvas they are placed on with no per-scheme handling.
 *
 * `accent` is the odd one out and is deliberately built from the *action* tokens
 * rather than from a status pair. It used to be
 * `bg-accent-100 text-accent-800 dark:bg-accent-950 dark:text-accent-200`, which
 * was the last `dark:` variant in the system and is now wrong twice over: the
 * page is dark regardless of the OS preference, so the `dark:` half was what
 * actually rendered - and it paired a near-black tinted fill with a pale red,
 * which is not a pair the contrast script audits and is not a pair anyone chose.
 *
 * It is now the same filled red the CTA uses, so an "accent" badge and an accent
 * button are visibly the same thing. That is the intent: this badge marks the
 * stock the dealership most wants to talk about.
 */
const TONES: Record<BadgeTone, string> = {
  neutral: "bg-neutral-surface text-neutral",
  success: "bg-success-surface text-success",
  warning: "bg-warning-surface text-warning",
  danger: "bg-danger-surface text-danger",
  info: "bg-info-surface text-info",
  accent: "bg-action-accent text-action-accent-content",
};

const DOT_TONES: Record<BadgeTone, string> = {
  neutral: "bg-neutral",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  accent: "bg-accent-500",
};

/**
 * Small status pill.
 *
 * Used for vehicle condition, enquiry state and system status. Tone pairs come
 * from the semantic tokens in `globals.css`, so a badge never hard-codes a
 * colour and stays legible wherever it is placed.
 *
 * `dot` is the variant to reach for on a listing tile. A bare word in a pill is
 * ambiguous at thumbnail size - "Sold" in a tinted box can read as a filter
 * chip - whereas a coloured dot reads as a state at a glance and keeps the text
 * available for anyone who cannot rely on colour.
 *
 * Vehicle states map onto tones as follows, and this mapping lives here rather
 * than at each call site so a "Reserved" badge cannot be a different colour on
 * two different pages:
 *
 *   Available -> success     Reserved -> warning     Sold  -> neutral
 *   New       -> accent      Used      -> info       Featured -> accent
 */
export function Badge({
  tone = "neutral",
  size = "md",
  dot = false,
  className,
  children,
}: {
  tone?: BadgeTone;
  size?: BadgeSize;
  /** Lead with a status dot. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xs font-semibold tracking-[0.08em] whitespace-nowrap uppercase",
        size === "sm" ? "px-1.5 py-0.5 text-[0.6875rem]" : "px-2 py-0.5 text-[0.75rem]",
        TONES[tone],
        className,
      )}
    >
      {dot ? (
        <span aria-hidden="true" className={cn("size-1.5 rounded-pill", DOT_TONES[tone])} />
      ) : null}
      {children}
    </span>
  );
}
