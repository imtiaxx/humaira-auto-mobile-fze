import { cn } from "@/lib/cn";

/**
 * Section header: an optional eyebrow, a heading and supporting copy.
 *
 * The eyebrow is a common device in automotive catalogue layouts - it labels a
 * group of vehicles ("Commercial", "Performance") without competing with the
 * heading for attention.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "start",
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "start" | "center";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow ? (
        <p className="text-xs font-semibold tracking-[0.18em] text-fg-accent uppercase">
          {eyebrow}
        </p>
      ) : null}

      <h2 className="text-2xl font-semibold text-fg md:text-3xl">{title}</h2>

      {description ? (
        <p className="max-w-2xl text-base text-fg-secondary">{description}</p>
      ) : null}
    </div>
  );
}
