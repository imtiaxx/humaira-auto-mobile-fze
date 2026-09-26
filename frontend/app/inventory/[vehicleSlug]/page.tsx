import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { VehicleBreadcrumb } from "@/features/vehicles/components/vehicle-breadcrumb";
import { VehicleDetails } from "@/features/vehicles/components/vehicle-details";
import { VehicleEnquiry } from "@/features/vehicles/components/vehicle-enquiry";
import { VehicleGallery } from "@/features/vehicles/components/vehicle-gallery";
import { VehicleSummary } from "@/features/vehicles/components/vehicle-summary";
import {
  formatVehiclePrice,
  hasQuotedPrice,
  vehiclePath,
  vehicleTitleWithYear,
} from "@/features/vehicles/lib/format";
import { getVehicleBySlug } from "@/features/vehicles/lib/inventory";
import { SITE_NAME } from "@/config/site";
import type { Vehicle } from "@/types/vehicle";

/**
 * An individual vehicle.
 *
 * ---------------------------------------------------------------------------
 * Why the route is `/inventory/[vehicleSlug]`
 * ---------------------------------------------------------------------------
 * It nests under `/inventory` because that is the one address the navigation
 * config already declares for vehicles, and a vehicle *is* an inventory listing
 * seen in full. `/vehicles/[slug]` would have been the tidier-looking choice and
 * it would have been wrong twice over: it would create a second vehicle URL space
 * alongside `/inventory`, and it would contradict the project's own vocabulary,
 * where "Vehicles" is the footer *group* and "Inventory" is the route.
 *
 * `vehicleSlug` rather than `slug` because it is the project's convention to name
 * things for what they are (`bodyType`, `headingId`, `vehicleTitle`). `id` is
 * deliberately not used: it is an internal surrogate key that is never displayed,
 * and a stored `slug` is what keeps a published URL stable when the make is
 * corrected. See `types/vehicle.ts`.
 *
 * ---------------------------------------------------------------------------
 * The not-found path
 * ---------------------------------------------------------------------------
 * `notFound()` for an unknown slug, which is the truthful result: the inventory is
 * empty, so every slug is unknown. It produces a real HTTP 404 and renders
 * `not-found.tsx` from this same segment - a vehicle-specific page that offers the
 * inventory, rather than the generic root 404 that offers only the homepage.
 *
 * `generateMetadata` returns a distinct, explicitly non-indexable title for the
 * same case rather than calling `notFound()` itself. Both are permitted by the
 * Next 16 docs, and returning a value is the better-behaved option here: the
 * request is answered with a real 404 by the page, while the document title is
 * still "Vehicle not found" rather than a stale vehicle's name being served for a
 * URL that does not exist.
 *
 * ---------------------------------------------------------------------------
 * Structure
 * ---------------------------------------------------------------------------
 *   VehicleBreadcrumb  orientation and the way back
 *   VehicleGallery     photography
 *   VehicleSummary     h1, status, price, key specifications
 *   VehicleDetails     full specification, and only when there is any
 *   VehicleEnquiry     conversion and the secondary path
 *
 * Gallery and summary sit side by side from the large breakpoint, which is the
 * arrangement a car listing is read in: the picture and the price together, with
 * neither one requiring a scroll to reach the other. The outline is h1 then h2s
 * with nothing skipped.
 */

/**
 * A description built only from fields that exist.
 *
 * The price is included when there is a figure and omitted when there is not,
 * because "Price on request" in a search result is noise and a made-up figure in
 * a meta tag is a lie. Nothing is described that the data does not record.
 */
function describeVehicle(vehicle: Vehicle): string {
  const facts = [
    String(vehicle.year),
    vehicle.transmission,
    vehicle.fuel,
    vehicle.bodyType,
    vehicle.mileage === null ? null : `${vehicle.mileage.toLocaleString("en-US")} km`,
  ].filter((fact): fact is string => fact !== null);

  /*
   * `hasQuotedPrice` rather than a `price === null` check of my own. The
   * formatter returns a phrase for a sold or unpriced vehicle, so a naive
   * interpolation produces meta descriptions reading "Listed at Sold." - which is
   * what the first version of this function did, and which shipped into the
   * description, `og:description` and `twitter:description` for a sold car.
   */
  const price = hasQuotedPrice(vehicle) ? `Listed at ${formatVehiclePrice(vehicle)}.` : null;

  return [
    `${vehicleTitleWithYear(vehicle)} in Dubai.`,
    facts.length > 0 ? `${facts.join(", ")}.` : null,
    price,
    "Enquire with Humera Automobile for current availability and a viewing.",
  ]
    .filter((part): part is string => part !== null)
    .join(" ");
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ vehicleSlug: string }>;
}): Promise<Metadata> {
  const { vehicleSlug } = await params;
  const vehicle = await getVehicleBySlug(vehicleSlug);

  if (!vehicle) {
    return {
      title: "Vehicle not found",
      // Matches the root 404's directive. This URL is never a real vehicle, so
      // there is nothing to index even once the site becomes indexable.
      robots: { index: false, follow: false },
    };
  }

  const description = describeVehicle(vehicle);
  const path = vehiclePath(vehicle.slug);

  return {
    /*
     * A plain string, so the root layout's `title.template` applies and this
     * renders as "2024 Toyota Land Cruiser | Humera Automobile". The homepage
     * needs `title.absolute` because it shares the `/` segment with the layout
     * that defines the template; this page does not.
     */
    title: vehicleTitleWithYear(vehicle),
    description,
    /*
     * The canonical address is built by `vehiclePath`, the same function the card
     * links with. Canonical and inbound link therefore cannot disagree, and
     * because the slug is a stored field it stays stable when the make or model
     * is corrected.
     */
    alternates: { canonical: path },
    /*
     * `openGraph` is written out in full rather than as an `openGraph: { url }`
     * one-liner. Next merges metadata between segments **shallowly**, so a nested
     * object defined in an earlier segment is overwritten wholesale by the last
     * segment to define it - which silently drops `og:type`, `og:site_name` and
     * `og:locale`. Restating them keeps this page correct on its own terms.
     */
    openGraph: {
      url: path,
      type: "website",
      siteName: SITE_NAME,
      locale: "en_AE",
      title: vehicleTitleWithYear(vehicle),
      description,
      /*
       * The photograph, when there is one. Omitted entirely when there is not,
       * rather than pointing at a placeholder - a social card showing a grey
       * panel with a car glyph would be a worse representation of the vehicle
       * than no image at all.
       */
      images: vehicle.images[0]
        ? [{ url: vehicle.images[0].src, alt: vehicle.images[0].alt }]
        : undefined,
    },
    /*
     * `robots` is deliberately not set for a real vehicle. The root layout
     * already declares the whole site `index: false, follow: false` while it has
     * no public content, and repeating the directive here would create a second
     * place to forget to change it when the site does become indexable.
     */
  };
}

export default async function VehiclePage({
  params,
}: {
  params: Promise<{ vehicleSlug: string }>;
}) {
  const { vehicleSlug } = await params;
  const vehicle = await getVehicleBySlug(vehicleSlug);

  // The truthful answer for every slug while the inventory is empty.
  if (!vehicle) notFound();

  return (
    <>
      <VehicleBreadcrumb vehicle={vehicle} />

      {/*
        The split. `lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]` rather than an
        even 50/50 because the summary is the narrower of the two: it is a title,
        a price and four short values, and giving the image more of the row is
        what makes the page look like an automotive listing rather than a form.

        `minmax(0, ...)` on both tracks is what prevents a long unbroken value
        from forcing the grid wider than its container. Order is image-then-summary
        in the DOM so a screen reader meets the picture before the figures, and
        the visual order matches that on wide screens without any reordering.
      */}
      <div className="bg-page">
        <div className="container-page grid grid-cols-1 items-start gap-8 py-10 sm:py-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12 lg:py-16">
          <VehicleGallery vehicle={vehicle} />

          <VehicleSummary vehicle={vehicle} />
        </div>
      </div>

      <VehicleDetails vehicle={vehicle} />

      <VehicleEnquiry vehicle={vehicle} />
    </>
  );
}
