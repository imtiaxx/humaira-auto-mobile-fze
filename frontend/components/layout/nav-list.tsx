"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActiveRoute } from "@/navigation/active";
import type { NavItem } from "@/navigation/config";
import { cn } from "@/lib/cn";

/**
 * The navigation list.
 *
 * ---------------------------------------------------------------------------
 * Why this is the only client component in the shell
 * ---------------------------------------------------------------------------
 * Active-route highlighting needs the current pathname, and in the App Router
 * the only way to read that is `usePathname`, which requires a Client Component.
 *
 * The obvious implementation - marking the whole header `"use client"` - throws
 * away the boundary: the brand, the CTA and the markup around the nav all become
 * part of the client bundle, and every header is re-rendered on navigation
 * instead of being static HTML.
 *
 * Instead the header and footer stay Server Components and this list is the
 * single island. The island is a `<ul>` of links and spans with no state, so it
 * is close to the smallest thing that can know the pathname. Both the desktop bar
 * and the mobile drawer render this same component, which means the active-state
 * rules are written once and cannot disagree between the two.
 *
 * Planned items are rendered here as inert spans rather than links. See
 * `navigation/config.ts` for why, and note that an inert span is not focusable
 * and cannot be activated, so it introduces no keyboard or screen-reader trap.
 */

export type NavListVariant = "desktop" | "stacked" | "mobile";

/**
 * Layout per variant, as whole class strings.
 *
 * Written out in full rather than composed from a shared base with overridable
 * parts, because `cn()` in this project is a plain joiner with no conflict
 * resolution. A caller passing `flex-col` to override a base of `flex-row`
 * would produce two conflicting utilities and leave CSS source order to decide
 * the winner - a bug that looks fine until it does not. Three explicit variants
 * means a caller never has to override layout at all.
 */
const VARIANT_LIST: Record<NavListVariant, string> = {
  // Header bar: one horizontal row, vertically centred.
  desktop: "flex items-center",
  // Footer column: a plain vertical list, left-aligned and tightly spaced.
  stacked: "flex flex-col items-start gap-2.5",
  // Drawer: full-width rows with a divider, sized for a thumb.
  mobile: "flex flex-col",
};

const VARIANT_ITEM: Record<NavListVariant, string> = {
  desktop: "flex",
  stacked: "",
  mobile: "",
};

const VARIANT_PLANNED: Record<NavListVariant, string> = {
  desktop: "px-3 py-2 text-body-sm",
  stacked: "text-body-sm",
  mobile: "border-b border-line px-1 py-4 text-body-lg",
};

const VARIANT_LINK: Record<NavListVariant, string> = {
  desktop: "px-3 py-2 text-body-sm",
  stacked: "text-body-sm",
  mobile: "border-b border-line px-1 py-4 text-body-lg",
};

/** Where the active indicator sits, per variant. */
const VARIANT_INDICATOR: Record<NavListVariant, string> = {
  desktop: "inset-x-2 -bottom-0.5 h-0.5",
  stacked: "inset-y-0 -left-3 w-0.5",
  mobile: "inset-x-0 -bottom-px h-0.5",
};

export function NavList({
  items,
  variant = "desktop",
  className,
  onNavigate,
}: {
  items: NavItem[];
  variant?: NavListVariant;
  className?: string;
  /**
   * Called after a link is activated. The mobile drawer passes its `close`
   * function so navigating also dismisses the menu - without it, following a link
   * from the drawer leaves the drawer open over the new page until the router
   * happens to unmount it.
   */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <ul className={cn("list-none", VARIANT_LIST[variant], className)}>
      {items.map((item) => {
        if (item.status === "planned") {
          return (
            <li key={item.path} className={VARIANT_ITEM[variant]}>
              <span
                // `title` explains the state on hover for a sighted pointer user.
                // The element is deliberately not focusable: there is no action
                // to take, and a focusable element that does nothing is a defect
                // a keyboard user would hit on every tab press.
                title={item.note}
                aria-disabled="true"
                data-status="planned"
                // Step 6: `text-fg-muted/70` -> `text-fg-muted`.
                //
                // The 70% alpha is what made these labels unreadable rather than
                // quiet. Composited, it measured ~2.4:1 in the header and ~2.6:1
                // in the footer - both far under the 4.5:1 that WCAG 1.4.3
                // requires, and the contrast audit could not catch it because
                // `color-mix` of a token over another token is not a pairing the
                // script resolves.
                //
                // Dropping the alpha rather than stepping up to
                // `text-fg-secondary` is deliberate. `VARIANT_PLANNED` carries
                // only padding, so this dimming is the *entire* visual signal
                // that an item cannot be clicked; matching the real links'
                // colour would make dead items look live. `text-fg-muted` is
                // still a clear step below `text-fg-secondary`, and it now
                // measures 4.6:1 in the header, 4.9:1 in the drawer and 6.2:1 on
                // the deep footer.
                className={cn("block truncate text-fg-muted", VARIANT_PLANNED[variant])}
              >
                {item.label}
              </span>
            </li>
          );
        }

        const active = isActiveRoute(pathname, item.href);

        return (
          <li key={item.href} className={VARIANT_ITEM[variant]}>
            <Link
              href={item.href}
              // `aria-current="page"` is the accessible signal. The visual
              // treatment below is decoration on top of it, so the current page
              // is still conveyed if the styling fails to load.
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                "relative block rounded-xs font-medium transition-colors duration-[var(--duration-fast)]",
                VARIANT_LINK[variant],
                // The current page is white with a red rule under it; everything
                // else is the secondary colour and warms toward the accent on
                // hover, so the red belongs to the current section rather than
                // appearing under every pointer as it passes through the bar.
                active
                  ? "text-fg"
                  : "text-fg-secondary hover:bg-sunken hover:text-fg-accent",
                // The drawer's rows are full-width and separated by rules, so a
                // background wash on hover would fight the divider. Everywhere
                // else it is the hover affordance.
                variant === "mobile" && !active && "hover:bg-transparent",
              )}
            >
              {item.label}
              {/*
                The active indicator. `aria-hidden` because `aria-current` above
                already conveys this; announcing it twice is noise.

                Absolutely positioned rather than a border so it can sit flush
                against the edge of a tight row without affecting layout height,
                which would shift the bar between pages.

                `--color-accent-700` rather than the lighter action accent: a
                2px rule this small needs the brand red at full strength to read
                as deliberate, and the light accent is reserved for filled
                surfaces large enough to carry it. Measured against the header's
                near-white it is 5.9:1, so it stays visible rather than becoming
                a tint.
              */}
              {active ? (
                <span
                  aria-hidden="true"
                  className={cn("absolute bg-accent-700", VARIANT_INDICATOR[variant])}
                />
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
