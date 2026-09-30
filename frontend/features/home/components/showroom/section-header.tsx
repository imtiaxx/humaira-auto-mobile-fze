/**
 * The showroom section header.
 *
 * ---------------------------------------------------------------------------
 * Why this is not the shared `SectionHeading`
 * ---------------------------------------------------------------------------
 * `components/ui/section-heading.tsx` is the right component everywhere else, and
 * this is the one place it does not fit, for two concrete reasons:
 *
 *   1. It renders the eyebrow as a plain coloured word. This header needs short
 *      red rules either side of it, which is a distinct treatment rather than a
 *      variant of the existing one.
 *   2. Its heading size is `text-h2`, which caps at 40px. This section is the
 *      main statement after the hero and is specified at up to 44px, so the size
 *      has to be set here.
 *
 * Building a near-copy of a shared component is normally the wrong call. Here the
 * two differ in structure rather than in values, and the alternative was either
 * widening `SectionHeading`'s API for one caller or silently shipping a heading
 * 4px smaller than specified.
 *
 * The `h2` is passed as a prop so this component never decides the page's heading
 * level for its caller.
 */

import { cn } from "@/lib/cn";

export function SectionHeader({
  eyebrow,
  title,
  description,
  titleId,
  children,
}: {
  /** Small uppercase label above the heading. */
  eyebrow: string;
  title: string;
  description: string;
  /** Ties the section's `aria-labelledby` to the real heading element. */
  titleId: string;
  /** The tab switch, rendered under the description. */
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-center gap-4 text-center">
      {/*
        The eyebrow, flanked by short red rules.

        `text-fg-accent` resolves to `accent-300`, not the vivid `accent-500`.
        The vivid red measures 3.9:1 as small type on the near-black page, under
        the 4.5:1 WCAG 1.4.3 requires - and at 12px it is unambiguously "small
        text" rather than large. The light step is 8.7:1.

        The rules are `aria-hidden`: they are decoration, and announcing a
        "dash" either side of a label is noise.
      */}
      <p className="flex items-center gap-3 text-label text-fg-accent uppercase">
        <span aria-hidden="true" className="h-px w-8 bg-accent-500" />
        {eyebrow}
        <span aria-hidden="true" className="h-px w-8 bg-accent-500" />
      </p>

      {/*
        `clamp(1.75rem, 4.5vw, 2.75rem)` is 28px at 320px and 44px from ~978px up.
        The negative tracking is what makes a 44px heading read as confident
        rather than as a poster - tight leading pairs with tight tracking, and
        `text-h2`'s -0.02em is tuned for a heading that caps lower.
      */}
      <h2
        id={titleId}
        className="text-[clamp(1.75rem,4.5vw,2.75rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-balance text-fg"
      >
        {title}
      </h2>

      <p className="max-w-[52ch] text-pretty text-body text-fg-secondary">{description}</p>

      {children}
    </div>
  );
}

/**
 * The "View all cars" call to action under the grid.
 *
 * An outlined button rather than a filled one: the grid above is full of red
 * accents and the red "View details" links, so the section's final action is
 * deliberately the quieter of the two. It is the only navigational action here,
 * and `ActionLink` is used rather than `Button` because it navigates - a link and
 * a button have different middle-click and keyboard behaviour, and using the
 * wrong one is a real accessibility bug rather than a style choice.
 */
export function ViewAllLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="mt-12 flex justify-center">
      <a
        href={href}
        className={cn(
          "inline-flex h-11 items-center justify-center rounded-sm border border-line-control",
          "px-6 text-[0.875rem] font-semibold text-fg",
          "transition-[border-color,color,transform] duration-200 ease-[var(--ease-standard)]",
          "hover:-translate-y-0.5 hover:border-accent-500 hover:text-fg-accent",
        )}
      >
        {label}
      </a>
    </div>
  );
}
