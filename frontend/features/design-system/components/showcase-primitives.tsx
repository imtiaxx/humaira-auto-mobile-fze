import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * A titled block on the design showcase page.
 *
 * `showcase/` holds no business content - it is a catalogue of the design
 * system's own primitives, so a future page can be built by looking at what
 * already exists rather than by inventing a new style.
 */
export function ShowcaseSection({
  id,
  title,
  description,
  children,
  className,
}: {
  /** Anchor id. Also the target of the in-page navigation. */
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)}>
      <div className="flex flex-col gap-1.5 border-b border-line pb-4">
        <h2 className="text-h3 text-fg">{title}</h2>
        {description ? <p className="text-body-sm text-fg-secondary">{description}</p> : null}
      </div>
      <div className="pt-6">{children}</div>
    </section>
  );
}

/**
 * A row inside a showcase section: a label on the left, the components being
 * demonstrated on the right.
 *
 * Stacks below `sm` so a long component list is never squeezed into a narrow
 * column next to its label.
 */
export function ShowcaseRow({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  /** Optional note about what to look for, e.g. the contrast requirement. */
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rule-bottom flex flex-col gap-3 py-5 last:border-b-0 sm:flex-row sm:items-start sm:gap-8",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1 sm:w-56 sm:shrink-0">
        <p className="text-body-sm font-medium text-fg">{label}</p>
        {hint ? <p className="text-body-sm text-fg-muted">{hint}</p> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">{children}</div>
    </div>
  );
}

/**
 * A framed specimen.
 *
 * A neutral checkerboard-free grid surface so component edges are visible
 * against both light and dark schemes without relying on a screenshot.
 */
export function Specimen({
  children,
  className,
  tone = "page",
}: {
  children: ReactNode;
  className?: string;
  tone?: "page" | "raised" | "sunken" | "inverse";
}) {
  const TONES = {
    page: "bg-page",
    raised: "bg-raised",
    sunken: "bg-sunken",
    inverse: "bg-inverse text-fg-inverse",
  } as const;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-card border border-line p-4",
        TONES[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Monospace token name, for the colour and type tables. */
export function TokenName({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-xs bg-sunken px-1.5 py-0.5 font-mono text-caption text-fg-secondary">
      {children}
    </code>
  );
}
