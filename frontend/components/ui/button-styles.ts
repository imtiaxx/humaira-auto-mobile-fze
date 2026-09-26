import { cn } from "@/lib/cn";

/**
 * Button recipes.
 *
 * This module is deliberately free of `"use client"`.
 *
 * That is a load-bearing detail. In Next.js App Router, `"use client"` marks the
 * whole module as a client boundary, so *everything* exported from it becomes a
 * client reference - including a plain function like `buttonClasses`. A Server
 * Component then cannot call it, and the build fails with "Attempted to call
 * buttonClasses() from the server". Keeping the class-name recipe here and only
 * the interactive `Button` component on the client side is what lets server
 * pages style a link as a button, which is most of the time this is used.
 */

export type ButtonVariant = "primary" | "accent" | "secondary" | "outline" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Shared shape of every button-like control.
 *
 * Deliberately one string for the box, one for the type, and one map each for
 * variant and size. Splitting it this way is what guarantees a `destructive`
 * button at `lg` is the same shape as a `ghost` button at `sm`.
 *
 * Font size lives only in SIZES, never here. Two competing `text-*` utilities in
 * one class list resolve by generated-CSS order rather than by the order they are
 * written, so a base size plus a size override is a silent bug waiting to happen.
 */
export const BUTTON_BASE =
  "relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap " +
  "rounded-sm font-semibold leading-none tracking-[0.005em] " +
  "transition-[background-color,border-color,color,box-shadow,transform] " +
  "duration-[var(--duration-fast)] ease-[var(--ease-standard)] " +
  "select-none " +
  // Pressed state. A 1px nudge reads as physical feedback without being an
  // animation anyone will consciously notice.
  "active:translate-y-px " +
  // Disabled is set on the element by the components that use this, so the
  // cursor and pointer-events follow the real `disabled` attribute rather than a
  // class that only looks disabled.
  "disabled:pointer-events-none disabled:opacity-50 " +
  // Guard against a nested icon or a long label breaking the box on mobile.
  "[&>svg]:size-4 [&>svg]:shrink-0";

export const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  /** The single most important action on a screen. Near-black, not gold. */
  primary:
    "bg-action-primary text-action-primary-content hover:bg-action-primary-hover active:bg-action-primary-hover",
  /**
   * The brand's conversion action: enquire, request an export quote. Brass fill
   * with near-black type - higher contrast than white-on-gold, and the more
   * traditional automotive treatment. Maximum one per view.
   */
  accent: "bg-action-accent text-action-accent-content hover:bg-action-accent-hover",
  /** Supporting action that needs a visible surface but not emphasis. */
  secondary: "border border-line-control bg-sunken text-fg hover:border-line-strong hover:bg-page",
  /** Lower-priority action. Transparent until hovered. */
  outline: "border border-line-control bg-transparent text-fg hover:bg-sunken active:bg-sunken",
  /** Subtle action: toolbar icons, dismissals, tertiary links. */
  ghost: "bg-transparent text-fg-secondary hover:bg-sunken hover:text-fg",
  /** Reserved for irreversible or data-losing admin actions. */
  destructive: "bg-action-danger text-action-danger-content hover:bg-action-danger-hover",
};

export const BUTTON_SIZES: Record<ButtonSize, string> = {
  // `sm` is for dense contexts (table rows, filter bars). At 32px it is below
  // the 44px touch target, so it is for pointer-first surfaces only.
  sm: "h-8 px-3 text-[0.8125rem]",
  // The default. `h-11` is 44px - the WCAG 2.5.8 minimum target size, so the
  // default button is usable on a phone without a special mobile variant.
  md: "h-11 px-4 text-[0.875rem]",
  lg: "h-12 px-6 text-base",
};

export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className);
}
