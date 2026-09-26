import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

export type ActionTone = "primary" | "accent" | "outline" | "ghost";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2.5 text-sm font-semibold transition-colors duration-150 ease-(--ease-out-soft) disabled:pointer-events-none disabled:opacity-55";

const TONES: Record<ActionTone, string> = {
  // Near-black. The default for anything that must not compete for attention.
  primary: "bg-inverse text-fg-inverse hover:bg-ink-800",
  // Brass. Exactly one per view - the primary conversion action.
  accent: "bg-accent-600 text-white hover:bg-accent-700",
  outline: "border border-line-strong bg-transparent text-fg hover:bg-sunken",
  ghost: "text-fg-secondary hover:bg-sunken hover:text-fg",
};

export function actionClasses(tone: ActionTone = "primary", className?: string): string {
  return cn(BASE, TONES[tone], className);
}

/**
 * Link styled as a button.
 *
 * A link is used rather than a `<button>` whenever the action navigates, which
 * keeps middle-click, "open in new tab" and keyboard behaviour correct.
 */
export function ActionLink({
  tone = "primary",
  className,
  children,
  ...props
}: {
  tone?: ActionTone;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<typeof Link>, "className">) {
  return (
    <Link className={actionClasses(tone, className)} {...props}>
      {children}
    </Link>
  );
}
