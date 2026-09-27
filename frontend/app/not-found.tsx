import type { Metadata } from "next";

import { ActionLink } from "@/components/ui/action-link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/**
 * The root 404 boundary - the one for URLs that match no route at all.
 *
 * ---------------------------------------------------------------------------
 * Why this file has to exist, separately from `app/(marketing)/not-found.tsx`
 * ---------------------------------------------------------------------------
 * Because a route group's `not-found.tsx` only catches a `notFound()` thrown from
 * inside that group's own segments. A URL that matches nothing - a typo, a stale
 * bookmark, a bad link from a campaign - is resolved against the *root* boundary,
 * and with no root `not-found.tsx` Next falls back to its own built-in page: an
 * unstyled white screen that looks like the site failed to load.
 *
 * That is a live possibility here, not a hypothetical one. The staff area's URLs
 * are the easiest thing in the project to mistype, and before the route groups
 * existed the single 404 covered everything.
 *
 * ---------------------------------------------------------------------------
 * Why it is deliberately plain, and carries no site navigation
 * ---------------------------------------------------------------------------
 * Because this page is reached from anywhere, including by a mistyped *staff* URL,
 * and a staff member who lands here should not be offered the public site's header
 * and a WhatsApp button. Equally it must not offer the staff chrome, because a
 * visitor who mistypes a public URL has no business being offered a sign-in form.
 *
 * So the only destination is the home page - the one URL that is valid in every
 * case - and the page says plainly that the address is wrong. A 404 that tried to
 * be clever about guessing what the visitor wanted would be guessing.
 */
export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-start justify-center gap-5 py-24">
      <p className="font-mono text-sm text-fg-muted">404</p>

      <h1 className="text-3xl font-semibold text-fg">This page does not exist</h1>

      <p className="max-w-prose text-fg-secondary">
        The address may be mistyped, or the page may have moved. If you were looking
        for a vehicle, the inventory is the place to start.
      </p>

      <ActionLink href="/" variant="primary">
        Back to home
      </ActionLink>
    </div>
  );
}
