import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Centred, width-constrained page shell.
 *
 * Every public page renders inside one of these so horizontal rhythm is
 * identical across the site. `as` allows a semantic element override where the
 * container is not a generic `div`.
 */
export function Container({
  as: Tag = "div",
  className,
  children,
}: {
  as?: "div" | "section" | "main" | "article" | "footer" | "header" | "nav";
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cn("container-page", className)}>{children}</Tag>;
}
