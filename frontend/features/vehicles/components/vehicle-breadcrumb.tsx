import Link from "next/link";

import { ArrowLeft, ChevronRight } from "@/components/icons";
import { Container } from "@/components/ui/container";
import { vehicleTitle } from "@/features/vehicles/lib/format";
import { cn } from "@/lib/cn";
import type { Vehicle } from "@/types/vehicle";

/**
 * The detail page's way back: a breadcrumb trail and an explicit return link.
 *
 * ---------------------------------------------------------------------------
 * Two ways back, because they answer two different questions
 * ---------------------------------------------------------------------------
 * A visitor arriving from a search result has no history to go back to, and the
 * browser's back button is unavailable or misleading to them. The breadcrumb
 * answers "where am I?" for someone who landed here directly, and the
 * "Back to all vehicles" link answers "how do I see the rest?" for someone who
 * clicked through from the grid and is now wondering what else there is.
 *
 * Both point at `/inventory`. There is no second inventory address, and no link
 * to any of the `planned` routes in the navigation config - those do not exist
 * yet, and a breadcrumb pointing at an unbuilt page is a dead link.
 *
 * ---------------------------------------------------------------------------
 * Breadcrumb semantics
 * ---------------------------------------------------------------------------
 * A real `<nav aria-label="Breadcrumb">` wrapping an ordered list, with
 * `aria-current="page"` on the last item. It is a hierarchy of ancestors, so
 * `<ol>` is the correct list and a row of `<span>`s would throw away the
 * structure that lets a screen reader say "2 of 3".
 *
 * The current page's own name is in the trail as text rather than as a link to
 * itself, and `aria-current` marks it, so a visitor who cannot see the image
 * still knows which vehicle they are on. The separators are `aria-hidden` - a
 * chevron between crumbs is a visual join, and announcing "chevron right" three
 * times in a row is noise.
 *
 * `text-balance` on the crumb list matters more here than anywhere else: vehicle
 * names are long and unpredictable ("Mercedes-Benz GLE 450 4MATIC AMG Line"), and
 * unbalanced wrapping in a single-line breadcrumb is what causes horizontal
 * overflow on a 320px screen.
 *
 * A Server Component: links and markup, no state, no JavaScript.
 */
export function VehicleBreadcrumb({ vehicle }: { vehicle: Vehicle }) {
  const title = vehicleTitle(vehicle);

  return (
    <div className="bg-page">
      <Container className="py-5 sm:py-6">
        <nav aria-label="Breadcrumb">
          <ol
            className={cn(
              "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1",
              // The trail is a single line of text that must never push the page
              // wider than the viewport. `min-w-0` plus wrapping crumbs is what
              // keeps a long vehicle name from becoming a horizontal scrollbar.
              "text-caption text-fg-secondary",
            )}
          >
            <li className="flex items-center">
              <Link href="/" className="transition-colors hover:text-fg">
                Home
              </Link>
            </li>

            <li aria-hidden="true" className="text-fg-muted">
              <ChevronRight className="size-3.5" />
            </li>

            <li className="flex items-center">
              <Link href="/inventory" className="transition-colors hover:text-fg">
                Inventory
              </Link>
            </li>

            <li aria-hidden="true" className="text-fg-muted">
              <ChevronRight className="size-3.5" />
            </li>

            {/*
              The current page. Not a link: a page should not link to itself. The
              name is allowed to wrap onto as many lines as it needs, which is why
              this item is allowed to break while the ancestors stay on one line.
            */}
            <li aria-current="page" className="min-w-0 text-balance text-fg">
              {title}
            </li>
          </ol>
        </nav>

        {/*
          The explicit return path. `ArrowLeft` is decorative - the label already
          says "back" - and `self-start` keeps the button at its natural width
          rather than stretching it across a phone screen.
        */}
        <Link
          href="/inventory"
          className="mt-5 inline-flex items-center gap-2 text-body-sm text-fg-secondary transition-colors hover:text-fg"
        >
          <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
          Back to all vehicles
        </Link>
      </Container>
    </div>
  );
}
