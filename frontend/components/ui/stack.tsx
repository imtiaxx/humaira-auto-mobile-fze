import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/cn";

/** The spacing steps a `Stack` may use. Mirrors the 4px-based scale. */
export type StackGap = "xs" | "sm" | "md" | "lg" | "xl";

const GAPS: Record<StackGap, string> = {
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-5",
  xl: "gap-8",
};

/**
 * Vertical rhythm for a group of elements.
 *
 * This is the component that makes the spacing scale real. The alternative -
 * a `mb-*` on every child - is how layouts drift apart: the last child ends up
 * with a trailing margin, two developers pick different values for the same
 * relationship, and a section ends up 4px taller than its neighbour. A `Stack`
 * owns the gaps between its children and nothing else, so the rhythm is decided
 * in one place and there is no trailing margin to strip.
 */
export function Stack({
  as: Tag = "div",
  gap = "md",
  align,
  className,
  children,
}: {
  as?: ElementType;
  gap?: StackGap;
  align?: "start" | "center" | "end" | "stretch";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={cn(
        "flex min-w-0 flex-col",
        GAPS[gap],
        align === "start" && "items-start",
        align === "center" && "items-center",
        align === "end" && "items-end",
        align === "stretch" && "items-stretch",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * Horizontal group that wraps instead of overflowing.
 *
 * Used for button rows, filter chips and metadata. `flex-wrap` rather than
 * `overflow-x-auto` because a scrollable row hides options off-screen on a
 * phone with no affordance indicating there is more; wrapping shows everything.
 */
export function Cluster({
  as: Tag = "div",
  gap = "sm",
  align = "center",
  justify = "start",
  className,
  children,
}: {
  as?: ElementType;
  gap?: StackGap;
  align?: "start" | "center" | "end" | "stretch";
  justify?: "start" | "center" | "end" | "between";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={cn(
        "flex min-w-0 flex-wrap",
        GAPS[gap],
        align === "start" && "items-start",
        align === "center" && "items-center",
        align === "end" && "items-end",
        align === "stretch" && "items-stretch",
        justify === "start" && "justify-start",
        justify === "center" && "justify-center",
        justify === "end" && "justify-end",
        justify === "between" && "justify-between",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
