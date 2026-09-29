import Link from "next/link";
import Image from "next/image";

import { BRAND } from "@/config/site";
import { cn } from "@/lib/cn";

import LogoImage from "@/lib/images/logo.png";

/**
 * The Humera Automobile brand treatment.
 *
 * Uses the official logo asset at `lib/images/logo.png`.
 * The mark is now an image rather than a type-based monogram.
 */

/** Visual size of the mark. Controls the box, not the image. */
export type BrandSize = "sm" | "md" | "lg";

const MARK_SIZES: Record<BrandSize, string> = {
  // Header on mobile, and the footer mark.
  sm: "size-8",
  // Header on desktop, footer lockup.
  md: "size-9",
  // Reserved for a future footer or hero lockup.
  lg: "size-12",
};

const WORDMARK_SIZES: Record<BrandSize, string> = {
  sm: "text-body-sm",
  md: "text-body",
  lg: "text-h4",
};

/**
 * The mark itself: the official logo image.
 *
 * Square box with the logo centered inside. The image scales to fill
 * the box while preserving its aspect ratio.
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
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xs",
        MARK_SIZES[size],
        className,
      )}
    >
      <Image
        src={LogoImage}
        alt=""
        width={32}
        height={32}
        className="h-full w-full object-contain"
        priority
      />
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
