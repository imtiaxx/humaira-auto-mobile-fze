import Link from "next/link";
import Image from "next/image";

import { BRAND } from "@/config/site";
import { cn } from "@/lib/cn";

import LogoImage from "@/lib/images/logo-cropped.png";

/**
 * The Humera Automobile brand treatment.
 *
 * Uses the official logo asset at `lib/images/logo.png`.
 * The mark is now an image rather than a type-based monogram.
 */

/** Visual size of the mark. Controls the box, not the image. */
export type BrandSize = "sm" | "md" | "lg";

const MARK_SIZES: Record<BrandSize, string> = {
  sm: "h-[57px] w-[67px]",
  md: "h-[61px] w-[71px]",
  lg: "h-[73px] w-[83px]",
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
 * The brand as a home link — logo + wordmark (default) or logo only.
 */
export function BrandLink({
  size = "md",
  logoOnly = false,
  className,
}: {
  size?: BrandSize;
  logoOnly?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label={`${BRAND.wordmark}, home`}
      className={cn(
        "inline-flex items-center rounded-xs",
        "focus-visible:outline-offset-4",
        className,
      )}
    >
      {logoOnly ? (
        <BrandMark size={size} />
      ) : (
        <Brand size={size} />
      )}
    </Link>
  );
}
