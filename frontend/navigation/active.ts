/**
 * Active-route matching.
 *
 * A pure function with no `"use client"` directive, so it is usable from a
 * Server Component, a Client Component, or a plain unit test without dragging a
 * React runtime along.
 *
 * The rules below are the whole reason this file exists. Naive matching
 * (`pathname === href`) breaks as soon as the site has nested routes, and
 * `pathname.startsWith(href)` breaks immediately: with a `/sell` item,
 * `/sell-your-car` would light up the "Sell / Source" tab, and `/compare-cars`
 * would light up "Compare Cars". Both are wrong and both are invisible in review.
 */

/**
 * True when `href` should be shown as the current page.
 *
 * - Exact match always wins, so `/` is never "active" by prefix.
 * - A section prefix matches only on a path *boundary*: `/export` matches
 *   `/export/shipping` but not `/exporting`.
 * - The root is excluded from prefix matching. Otherwise every page would show
 *   the Home tab as active, which is the most common version of this bug.
 */
export function isActiveRoute(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";

  const normalise = (value: string): string =>
    value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;

  const target = normalise(href);
  const current = normalise(pathname);

  if (current === target) return true;

  // The trailing slash is what forces the match onto a path boundary, so
  // "/export" cannot match "/exporting".
  return current.startsWith(`${target}/`);
}

/** True when any item in the list is the current page. Drives `aria-current`. */
export function hasActiveItem(pathname: string, hrefs: string[]): boolean {
  return hrefs.some((href) => isActiveRoute(pathname, href));
}
