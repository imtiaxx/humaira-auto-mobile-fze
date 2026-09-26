import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Bordered surface used for panels, cards and data rows.
 *
 * Elevation is expressed with a hairline border plus a very low shadow rather
 * than a large drop shadow, which keeps dense inventory grids from turning into
 * a stack of floating tiles.
 */
export function Surface({
  as: Tag = "div",
  variant = "raised",
  className,
  children,
}: {
  as?: "div" | "section" | "article" | "li" | "tr";
  variant?: "raised" | "sunken" | "inverse";
  className?: string;
  children: ReactNode;
}) {
  const variants = {
    raised: "bg-raised border border-line shadow-xs",
    sunken: "bg-sunken border border-line",
    inverse: "bg-inverse border border-transparent",
  } as const;

  return (
    <Tag className={cn("rounded-card", variants[variant], className)}>{children}</Tag>
  );
}
