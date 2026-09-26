import Link from "next/link";

import { BRAND } from "@/config/site";
import { cn } from "@/lib/cn";

/**
 * The Humera Automobile brand treatment.
 *
 * ---------------------------------------------------------------------------
 * Why this is type, not an image
 * ---------------------------------------------------------------------------
 * No official logo asset exists yet, and inventing one - or pulling a
 * lookalike off the internet - would be worse than having none. A downloaded
 * mark carries someone else's copyright and is not this business's brand.
 *
 * So the wordmark is set in the site's own display face. That is a legitimate
 * interim identity rather than a placeholder: it is crisp at any density, it
 * inherits the design system's type tokens, it needs no image request, and it
 * cannot be the wrong logo.
 *
 * ---------------------------------------------------------------------------
 * How the official logo replaces it
 * ---------------------------------------------------------------------------
 * Everything about the mark is confined to `BrandMark` below: the artwork, its
 * box, and its proportions. The header and footer only ever compose
 * `<Brand />`, so dropping in the real asset means editing one component -
 * either replacing the mark's contents, or rendering an `<Image>` there. No
 * layout, header or footer change is needed, and the mark keeps its size and
 * alignment because the box is fixed by the `size` prop rather than by the
 * artwork's own dimensions.
 */

/** Visual size of the mark. Controls the box, not the type. */
export type BrandSize = "sm" | "md" | "lg";

const MARK_SIZES: Record<BrandSize, string> = {
  // Header on mobile, and the footer mark.
  sm: "size-8 text-[0.6875rem]",
  // Header on desktop, footer lockup.
  md: "size-9 text-[0.75rem]",
  // Reserved for a future footer or hero lockup.
  lg: "size-12 text-base",
};

const WORDMARK_SIZES: Record<BrandSize, string> = {
  sm: "text-body-sm",
  md: "text-body",
  lg: "text-h4",
};

/**
 * The mark itself: a bordered monogram tile.
 *
 * Square rather than round, `rounded-xs` rather than a pill, and outlined in the
 * brass accent. That is the design system's angular, low-radius language applied
 * at the smallest scale, so the mark reads as part of the same system as the
 * buttons around it.
 *
 * The accent is a border, not a fill. A filled brass tile at this size would put
 * the strongest colour in the system on the least important element.
 */
export function BrandMark({
  size = "md",
  className,
}: {
  size?: BrandSize;
  className?: string;
}) {
  return (
    <span
      // Decorative: the wordmark beside it already names the business, so this
      // must not be announced as a second, redundant label.
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xs border border-accent-500/60 font-display font-semibold leading-none tracking-[0.06em] text-accent-600 dark:text-accent-400",
        MARK_SIZES[size],
        className,
      )}
    >
      {BRAND.initials}
    </span>
  );
}

/**
 * Full brand lockup: mark plus wordmark.
 *
 * `priority` is deliberately absent. This is a small text-based mark, not a
 * large hero image, so it should not compete for bandwidth with page content.
 */
export function Brand({
  size = "md",
  className,
}: {
  size?: BrandSize;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark size={size} />
      <span
        className={cn(
          "font-display font-semibold tracking-[-0.01em] whitespace-nowrap text-fg",
          WORDMARK_SIZES[size],
        )}
      >
        {BRAND.wordmark}
      </span>
    </span>
  );
}

/**
 * The brand as a home link.
 *
 * Wrapping the lockup in a link to `/` is what makes the logo clickable, which
 * is an almost universal expectation. Two details keep it accessible:
 *
 * - `aria-label` states the destination, not the appearance, so it is announced
 *   as "Humera Automobile, home" rather than reading out the initials twice.
 * - The visible wordmark is hidden from assistive technology to avoid the same
 *   text being announced twice.
 */
export function BrandLink({
  size = "md",
  className,
}: {
  size?: BrandSize;
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label={`${BRAND.wordmark}, home`}
      className={cn(
        "inline-flex items-center rounded-xs",
        // A visible focus ring on a logo is required, but the default outline
        // around a wide, mostly-empty link box looks wrong. Insetting it keeps
        // it attached to the lockup.
        "focus-visible:outline-offset-4",
        className,
      )}
    >
      <Brand size={size} />
    </Link>
  );
}
