import type { Route } from "next";

/**
 * The site's information architecture, in one place.
 *
 * Header, mobile drawer, footer and sitemap all read from this file. Adding a
 * page in a later step is a one-line change here rather than an edit to three
 * components, which is the whole point: navigation strings never get scattered
 * through JSX, so they cannot drift out of sync or get forgotten.
 *
 * ---------------------------------------------------------------------------
 * Why items carry a `status`
 * ---------------------------------------------------------------------------
 * The site is being built in stages, and most destinations do not exist yet.
 * There are two ways to handle that, and the wrong one is common:
 *
 *   1. Link to the routes anyway. The header looks finished, and every one of
 *      those links is a 404. A navigation full of dead links is worse than an
 *      obviously incomplete one, because it reads as a broken site rather than
 *      an unfinished one.
 *   2. Create stub pages so the links resolve. Now the site advertises content
 *      that does not exist, and the stubs have to be remembered and removed.
 *
 * This file takes a third route: an item is either `live` or `planned`.
 *
 *   - `live` items render as real `next/link` elements. `href` is typed as
 *     Next's `Route`, so the compiler rejects any path that is not a real route
 *     in the app directory. A typo becomes a build failure, not a 404.
 *   - `planned` items render as inert, visibly de-emphasised text. They are not
 *     links, are not focusable, and cannot be activated. `path` is recorded so
 *     the intended URL is decided now rather than rediscovered later, and is
 *     typed as a template literal so it stays a plausible route.
 *
 * Promoting an item when its page lands is a two-word edit - `status: "live"`
 * and `path` becomes `href` - and the compiler immediately verifies the route
 * exists. No component changes, no stub pages, no dead links.
 *
 * See `docs/design-system.md` for the rendering rules this implies.
 */

/** A destination that exists and is safe to link to. */
export type LiveNavItem = {
  label: string;
  status: "live";
  /** Typed as a real route, so a non-existent path fails to compile. */
  href: Route;
  /**
   * Appended to the link's `title` and exposed to assistive technology, so a
   * visitor is not left guessing why a destination is not clickable.
   */
  unavailableNote?: never;
};

/** A destination reserved for a later step. Never rendered as a link. */
export type PlannedNavItem = {
  label: string;
  status: "planned";
  /** The URL this will become. Not a link until the route exists. */
  path: `/${string}`;
  /** Why it is not clickable yet. Surfaced in the item's `title`. */
  note: string;
};

export type NavItem = LiveNavItem | PlannedNavItem;

export type NavGroup = {
  /** Heading for the group. Rendered as a real heading, not a styled `div`. */
  title: string;
  /** Used to build the group's `aria-label` in the mobile drawer. */
  id: string;
  items: NavItem[];
};

/**
 * Primary navigation, in order of importance.
 *
 * Order matters more than it looks: this is the order a first-time visitor
 * scans, so the two things the business most wants a visitor to do - browse
 * stock, and ask a question - sit either side of the middle rather than being
 * buried.
 */
export const PRIMARY_NAV: NavItem[] = [
  { label: "Home", status: "live", href: "/" },
  {
    // Step 7: promoted from `planned` to `live`. `/inventory` is a real route
    // now (`app/inventory/page.tsx`), so this is a real link - and the `Route`
    // type means the compiler has just verified the path exists. The label is
    // unchanged: "Inventory" is what this site has always called this
    // destination in the header and the footer, and renaming it here would break
    // the vocabulary the rest of the IA is built on.
    label: "Inventory",
    status: "live",
    href: "/inventory",
  },
  {
    // Promoted from `planned` to `live` when `/sell` was built
    // (`app/(marketing)/sell/page.tsx`). `path` became `href`, and because `href`
    // is typed as Next's `Route` the compiler verified the route exists as part
    // of the same change. The label is unchanged - "Sell / Source" is the
    // vocabulary this site has always used for these two services, and
    // `navigation/active.ts` already reasons about the `/sell` path.
    label: "Sell / Source",
    status: "live",
    href: "/sell",
  },
  {
    // Promoted from `planned` to `live` when `/about` was built
    // (`app/(marketing)/about/page.tsx`). `path` became `href`, and because `href`
    // is typed as Next's `Route` the compiler verified the route exists as part of
    // the same change. The label is unchanged - it is the vocabulary the rest of
    // the information architecture is built on.
    label: "About",
    status: "live",
    href: "/about",
  },
{
      // Promoted from `planned` to `live` when `/contact` was built
      // (`app/(marketing)/contact/page.tsx`). `path` became `href`, so the compiler
      // verified the route exists in the same change that promoted it.
      label: "Contact",
      status: "live",
      href: "/contact",
    },
];

/**
 * Footer navigation.
 *
 * Grouped by what a visitor is trying to do rather than by which team owns the
 * page. "Vehicles" and "Export" are the two things this business does, so they
 * get the most prominent real estate; "Company" is trust-building and sits last
 * in reading order even though it is listed first here for code readability.
 */
export const FOOTER_NAV: NavGroup[] = [
  {
    id: "company",
    title: "Company",
    items: [
      // Promoted to `live` alongside the primary nav item, same reason. Left in the
      // Company group because the group is titled for the section and this is the
      // page that introduces it.
      { label: "About", status: "live", href: "/about" },
      // Promoted to `live` alongside the primary nav item, same reason.
      { label: "Contact", status: "live", href: "/contact" },
      { label: "FAQ", status: "planned", path: "/faq", note: "Not built yet" },
    ],
  },
  {
    id: "vehicles",
    title: "Vehicles",
    items: [
      // Step 7: promoted to `live` alongside the primary nav item, so the
      // header and this group resolve to the same real route.
      { label: "Inventory", status: "live", href: "/inventory" },
      // Step 14: promoted alongside the primary nav item, same reason. Left in
      // the Vehicles group rather than a new "Brands" group, because the group
      // is titled for the section and this is another view of the same stock -
      // splitting it out would suggest a separate area of the site.
      { label: "Brands", status: "live", href: "/brands" },
        // Step 15: promoted alongside the primary nav item, same reason. Left in
        // the Vehicles group because the group is titled for the section and a
        // comparison is a view of the same stock, not a separate area of the site.
        { label: "Compare Cars", status: "live", href: "/compare" },
    ],
  },
  {
    id: "export",
    title: "Export",
    items: [
      { label: "Export Worldwide", status: "planned", path: "/export", note: "Not built yet" },
      { label: "Shipping", status: "planned", path: "/export/shipping", note: "Not built yet" },
      {
        label: "Documentation",
        status: "planned",
        path: "/export/documentation",
        note: "Not built yet",
      },
    ],
  },
  {
    id: "customers",
    title: "Sell / Source",
    items: [
      {
        // Promoted to `live` alongside the primary nav item, same reason. This is
        // the entry that actually names the page, so the link text is
        // "Sell / Source" rather than the older "Sell / Source a Car" - the page
        // covers both selling and sourcing, and the old wording implied only
        // selling.
        label: "Sell / Source",
        status: "live",
        href: "/sell",
      },
      {
        label: "Request a Vehicle",
        status: "planned",
        path: "/request",
        note: "Not built yet",
      },
    ],
  },
];

/** Flattens the footer groups into a single list, for sitemap generation. */
export function allPlannedRoutes(): string[] {
  return FOOTER_NAV.flatMap((group) =>
    group.items.filter((item) => item.status === "planned").map((item) => item.path),
  ).concat(PRIMARY_NAV.filter((i) => i.status === "planned").map((i) => i.path));
}
