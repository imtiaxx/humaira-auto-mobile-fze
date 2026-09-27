import type { Metadata } from "next";

import { ActionLink } from "@/components/ui/action-link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/**
 * 404 boundary for the public site.
 *
 * Catches a `notFound()` thrown from this group's own segments - a vehicle slug
 * that no longer resolves, for example - where the visitor is somewhere in the
 * marketing site and the header and footer are already the right furniture.
 *
 * Not the boundary for an address that matches no route at all: that is resolved
 * against the root `app/not-found.tsx`, which has to work without any of the
 * site's navigation. See the note there.
 *
 * The link is to the home page rather than to a guess at what was wanted, because
 * a 404 that tried to infer the intended destination would be inferring.
 */
export default function NotFound() {
  return (
    <div className="container-page flex flex-col items-start justify-center gap-5 py-24">
      <p className="font-mono text-sm text-fg-muted">404</p>
      <h1 className="text-3xl font-semibold text-fg">This page does not exist</h1>
      <p className="max-w-prose text-fg-secondary">
        The link may be out of date, or the page may have been moved.
      </p>
      <ActionLink href="/" variant="primary">
        Back to home
      </ActionLink>
    </div>
  );
}
