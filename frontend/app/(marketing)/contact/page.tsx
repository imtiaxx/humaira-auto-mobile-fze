import type { Metadata } from "next";

import { ContactPageBody } from "@/features/vehicles/components/contact-page";
import type { ContactEnquiryVehicle } from "@/features/vehicles/components/contact-enquiry-form";
import { listVehicles } from "@/features/vehicles/lib/inventory";
import { vehicleTitle } from "@/features/vehicles/lib/format";
import { SITE_NAME } from "@/config/site";

/**
 * The Contact page.
 *
 * ---------------------------------------------------------------------------
 * Why this route is `/contact`
 * ---------------------------------------------------------------------------
 * Because `navigation/config.ts` says so. `Contact` is declared with
 * `path: "/contact"` in both the primary nav and the footer's Company group, and
 * promoting those entries to `live` was the only change needed to make the page
 * reachable. There is no second URL for the same content.
 *
 * ---------------------------------------------------------------------------
 * Why this route fetches and is therefore not static
 * ---------------------------------------------------------------------------
 * The enquiry form's vehicle select has to offer real vehicles, because the
 * backend stores every enquiry against a `vehicle_id` that is `NOT NULL` and the
 * only public endpoint is `POST /vehicles/{slug}/enquiry`. There is no way to build
 * that select from a build-time constant without it going stale the moment a car is
 * added or sold.
 *
 * So the list is fetched here and passed down as plain `{ slug, title }` objects.
 * `listVehicles` returns `[]` rather than throwing when the API is unreachable,
 * which lands the page on the "nothing listed" branch instead of a 500 - the right
 * outcome for a contact page, which should still render when the inventory API is
 * down.
 *
 * ---------------------------------------------------------------------------
 * What `vehicleTitle` is for
 * ---------------------------------------------------------------------------
 * Option labels read "2021 Toyota Land Cruiser", the same words the card, the grid
 * and the detail page heading use. Deriving them from one helper means a vehicle
 * cannot be called something in the select that it is not called everywhere else.
 *
 * Only the two fields the form needs are passed across the server/client boundary
 * rather than whole `Vehicle` records: the client's price formatting, status labels
 * and image helpers are not needed to render an `<option>`, and a select of full
 * records would serialise the entire inventory into the HTML payload.
 */
export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact Humera Automobile. Send an enquiry about a vehicle in our Dubai showroom, or ask us to source a specific make, model, year and budget.",
  alternates: { canonical: "/contact" },
  openGraph: {
    url: "/contact",
    // Restated rather than inherited: Next merges segment metadata shallowly, so a
    // page-level `openGraph` replaces the root layout's object instead of adding to
    // it, and the one-liner would drop `og:type`, `og:site_name` and `og:locale`.
    type: "website",
    siteName: SITE_NAME,
    locale: "en_AE",
  },
};

export default async function ContactPage() {
  const vehicles: ContactEnquiryVehicle[] = (await listVehicles()).map((vehicle) => ({
    slug: vehicle.slug,
    title: vehicleTitle(vehicle),
  }));

  return <ContactPageBody vehicles={vehicles} />;
}