import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Bordered surface used for panels, cards and data rows.
 *
 * ---------------------------------------------------------------------------
 * Why the shadow is doing the work the fill used to
 * ---------------------------------------------------------------------------
 * On a white page a card is separated from the page by being *brighter* than it,
 * and the shadow is a refinement. On the black showroom canvas there is nowhere
 * brighter to go, so a card is separated by three things instead, in order of how
 * much they actually contribute:
 *
 *   1. the hairline border - the only one of the three that is load-bearing, and
 *      the reason `--border-subtle` sits several steps up the ramp
 *   2. a soft black shadow that lifts the card off the page
 *   3. `--surface-raised` being one step lighter than the page
 *
 * Dropping any one of them on near-black produces a card that looks like a
 * wireframe or a hole, so they are set together rather than tuned individually.
 *
 * `interactive` is opt-in rather than the default. A data row in the staff
 * vehicle table is a `Surface` and must *not* light up red on hover, and it
 * cannot be expressed by styling this component alone - the hover is a
 * relationship between the card and the pointer, not a property of the card.
 * Call sites that are actually clickable ask for it.
 */
export function Surface({
  as: Tag = "div",
  variant = "raised",
  interactive = false,
  className,
  children,
}: {
  as?: "div" | "section" | "article" | "li" | "tr";
  variant?: "raised" | "sunken" | "inverse";
  /**
   * Adds the red hover treatment. Only for surfaces that are genuinely a link or
   * a click target - a card that is not clickable must not invite the pointer.
   */
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const variants = {
    // `card-edge` rather than a bare `shadow-sm`: the utility adds the top-edge
    // highlight that makes a card read as *raised* on a near-black canvas. A card
    // with only a drop shadow here looks like a hole, because the shadow is
    // invisible against a surface it barely differs from.
    raised: "bg-raised border border-line card-edge",
    sunken: "bg-sunken border border-line",
    inverse: "bg-inverse border border-transparent",
  } as const;

  return (
    <Tag
      className={cn(
        "rounded-card",
        variants[variant],
        // The glow is `--shadow-glow-red`: a 1px red hairline plus a wide, low
        // alpha bloom. `focus-within` mirrors hover so tabbing to a card's link
        // produces the same emphasis the pointer does - without that, the
        // keyboard path through a grid of cards gets no affordance at all.
        // `card-edge-interactive` supersedes the plain `card-edge` in the variant
        // above, because both write `box-shadow` and the later utility in the
        // cascade wins. It carries the lift, the red-tinted border and the
        // transition together, so the resting and hovered states cannot drift
        // apart. `focus-within` is inside the utility, matching hover, so the
        // keyboard path through a card grid gets the same affordance.
        interactive && "card-edge-interactive",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
