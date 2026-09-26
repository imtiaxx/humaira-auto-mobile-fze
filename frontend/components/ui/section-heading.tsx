import { cn } from "@/lib/cn";

/**
 * Section header: an optional eyebrow, a heading and supporting copy.
 *
 * The eyebrow is a common device in automotive catalogue layouts - it labels a
 * group of vehicles ("Commercial", "Performance") without competing with the
 * heading for attention.
 *
 * `level` exists so a section heading is a real `h2` on a page and a real `h3`
 * when it appears inside another section. Getting this wrong breaks the heading
 * outline, which is the single most useful structure a screen reader user has.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "start",
  level = 2,
  className,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "start" | "center";
  /** Heading level. `2` for a top-level section, `3` when nested. */
  level?: 2 | 3;
  className?: string;
  /** Optional action rendered opposite the heading on wide viewports. */
  children?: React.ReactNode;
}) {
  const Heading = level === 2 ? "h2" : "h3";

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        // On wide viewports a section header with an action puts the action on
        // the same line as the heading, which saves vertical space without
        // affecting the stacked mobile layout.
        "md:flex-row md:items-end md:justify-between md:gap-8",
        align === "center" && "md:flex-col md:items-center md:text-center",
        className,
      )}
    >
      <div
        className={cn(
          "flex min-w-0 flex-col gap-2.5",
          align === "center" && "items-center",
        )}
      >
        {eyebrow ? (
          <p className="text-label text-fg-accent uppercase">{eyebrow}</p>
        ) : null}

        <Heading className={cn(level === 2 ? "text-h2" : "text-h3", "text-fg")}>
          {title}
        </Heading>

        {description ? (
          <p className="max-w-2xl text-body-lg text-fg-secondary">{description}</p>
        ) : null}
      </div>

      {children ? <div className="flex shrink-0 items-center gap-3">{children}</div> : null}
    </div>
  );
}
