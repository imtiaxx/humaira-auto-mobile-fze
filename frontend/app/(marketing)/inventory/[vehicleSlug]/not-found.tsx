import type { Metadata } from "next";
import Link from "next/link";

import { ArrowLeft } from "@/components/icons";
import { ActionLink } from "@/components/ui/action-link";

/**
 * The 404 for an unknown vehicle slug.
 *
 * ---------------------------------------------------------------------------
 * Why this is a segment boundary and not the root 404
 * ---------------------------------------------------------------------------
 * The root `app/not-found.tsx` handles unmatched routes for the whole site, and
 * its only way out is the homepage. That is the right default for "that URL does
 * not exist", but it is a poor answer to a specific and common question: someone
 * followed a vehicle link, or bookmarked a listing that has since been sold or
 * withdrawn, and the useful destination is the inventory - not the homepage, from
 * which they would have to navigate back down to where they started.
 *
 * A `not-found.tsx` in this segment is rendered by `notFound()` called from the
 * page beside it, which is the documented behaviour, and it keeps the HTTP status
 * at 404. The root boundary is untouched, so genuinely unknown *routes* still get
 * the generic page.
 *
 * ---------------------------------------------------------------------------
 * What it does not say
 * ---------------------------------------------------------------------------
 * It does not claim the vehicle was sold, does not say it has been "removed" or
 * "expired", and does not apologise for an error. A URL can be unknown for
 * reasons that are not "this listing ended" - a typo, a vehicle never published, a
 * guessed link - and asserting a cause the data cannot support is the same class
 * of mistake as inventing a price.
 *
 * It also does not suggest a similar vehicle. There is no inventory to search and
 * no search, so a "did you mean" would be a guess. The two links below are the
 * only two things that are actually true and actually available.
 *
 * `robots: noindex, nofollow` matches the root 404. This URL must never be
 * indexed in any circumstance, including after the site becomes indexable.
 */
export const metadata: Metadata = {
  title: "Vehicle not found",
  robots: { index: false, follow: false },
};

export default function VehicleNotFound() {
  return (
    <div className="container-page flex flex-col items-start justify-center gap-5 py-24">
      <p className="font-mono text-sm text-fg-muted">404</p>

      <h1 className="text-h1 text-fg text-balance">This vehicle is not listed</h1>

      <p className="max-w-prose text-fg-secondary">
        This vehicle is not in Humera Automobile&apos;s inventory, so there is
        nothing to show here. It may never have been listed, or it may no longer
        be available.
      </p>

      {/*
        Two routes out, and both exist. The inventory is the useful one - it is
        where a visitor goes to see what is actually available - and the homepage
        is offered because the root 404 offers it too, so a visitor who expected
        to be on the home page is not stranded.

        `ActionLink` is used for the primary because it is a real `next/link`
        styled as a button, which keeps middle-click and "open in new tab"
        working. The secondary is a plain styled link, not a second
        button-shaped control competing with the first.
      */}
      <ActionLink href="/inventory" variant="primary">
        Browse all vehicles
      </ActionLink>

      <Link
        href="/"
        className="inline-flex items-center gap-2 text-body-sm text-fg-secondary transition-colors hover:text-fg"
      >
        <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
        Back to home
      </Link>
    </div>
  );
}
