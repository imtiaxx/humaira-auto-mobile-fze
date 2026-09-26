import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * A labelled horizontal rule.
 *
 * A `<hr>` with an optional centred label. Implemented as a real `<hr>` so the
 * separator is exposed to assistive technology as a structural boundary rather
 * than as decoration that gets announced.
 *
 * `spacing` exists so a divider is never responsible for its own vertical
 * rhythm - the gap belongs to the parent `Stack`, and an `hr` inside a flex
 * column would otherwise collapse.
 */
export function Divider({
  label,
  orientation = "horizontal",
  className,
}: {
  label?: ReactNode;
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  if (orientation === "vertical") {
    return (
      <span
        role="separator"
        aria-orientation="vertical"
        className={cn("inline-block h-full w-px self-stretch bg-line", className)}
      />
    );
  }

  if (!label) {
    return <hr className={cn("border-0 border-t border-line", className)} />;
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn("flex items-center gap-3", className)}
    >
      <span className="h-px flex-1 bg-line" />
      <span className="text-label text-fg-muted uppercase">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
