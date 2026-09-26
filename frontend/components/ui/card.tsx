import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * A content card.
 *
 * The default is deliberately flat: a hairline border, no shadow. Elevation is
 * reserved for genuinely raised things (a dropdown, a dialog), because a page
 * made entirely of shadowed boxes loses its hierarchy - everything floats, so
 * nothing is important.
 *
 * `interactive` is for cards that are themselves a link or button (a vehicle
 * tile, a saved-search row). It adds a small lift and border darkening on hover
 * plus `focus-within`, so a keyboard user sees the same affordance a mouse user
 * does. It is not a substitute for a real focus ring on the interactive child -
 * the global `:focus-visible` outline still applies to that.
 */
export function Card({
  as: Tag = "div",
  interactive = false,
  className,
  children,
}: {
  as?: "div" | "article" | "li" | "section";
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={cn(
        "rounded-card border border-line bg-raised",
        interactive &&
          "transition-[border-color,box-shadow,transform] duration-[var(--duration-base)] ease-[var(--ease-standard)] hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md focus-within:-translate-y-0.5 focus-within:border-line-strong focus-within:shadow-md",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * Fixed-ratio media area for a card.
 *
 * Vehicle imagery is the main visual event on an inventory page, and the most
 * common layout failure is letting images of different aspect ratios push a
 * grid out of alignment. Fixing the ratio here means a card grid stays a grid
 * whatever loads.
 */
export function CardMedia({
  ratio = "4 / 3",
  className,
  children,
}: {
  ratio?: "16 / 9" | "4 / 3" | "3 / 2" | "1 / 1";
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn("relative overflow-hidden bg-sunken", className)}
      style={{ aspectRatio: ratio }}
    >
      {children}
    </div>
  );
}

/** Card title area. `CardTitle` renders an `h3` unless told otherwise. */
export function CardHeader({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("flex flex-col gap-1.5 p-5", className)}>{children}</div>;
}

export function CardTitle({
  as: Tag = "h3",
  className,
  children,
}: {
  as?: "h2" | "h3" | "h4";
  className?: string;
  children: ReactNode;
}) {
  return <Tag className={cn("text-h4 text-fg", className)}>{children}</Tag>;
}

export function CardDescription({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn("text-body-sm text-fg-secondary", className)}>{children}</p>;
}

/** Card body. Pairs with `CardHeader`, which carries its own padding. */
export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("px-5 pb-5", className)}>{children}</div>;
}

/** Card footer, separated by a hairline rather than a shadow. */
export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rule-top flex flex-wrap items-center gap-3 px-5 py-4", className)}>
      {children}
    </div>
  );
}
