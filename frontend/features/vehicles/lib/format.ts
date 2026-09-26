import type { Vehicle } from "@/types/vehicle";

/**
 * Vehicle display formatting.
 *
 * ---------------------------------------------------------------------------
 * The one place a vehicle price becomes a string
 * ---------------------------------------------------------------------------
 * Step 7 formatted prices privately inside `vehicle-card.tsx`. That was fine with
 * one renderer and stops being fine the moment a second page renders the same
 * figure: a detail page with its own copy of this function is a page that can
 * disagree with the grid about how a car is priced, and a disagreement about
 * price is the worst kind of bug a vehicle site can ship.
 *
 * So the formatting lives here, next to the data seam in `inventory.ts`, and both
 * the card and the detail page import it. There is one implementation, one set of
 * rules and one place to change them.
 *
 * ---------------------------------------------------------------------------
 * USD, and why the locale is pinned to `en-US`
 * ---------------------------------------------------------------------------
 * Prices are quoted in USD - the only customer-facing currency for this business
 * - and rendered with a bare `$`.
 *
 * The locale is pinned, and pinned to `en-US` specifically. This is not a
 * cosmetic choice. `Intl.NumberFormat` derives both the symbol and the separators
 * from the locale, so the *same* `USD` price renders differently by environment:
 *
 *   - `en-US` + USD -> "$35,000"     what a customer expects to read
 *   - `en-AE` + USD -> "US$35,000"   an ambiguous prefix on a page whose business
 *                                     is in Dubai
 *
 * Relying on the runtime default is therefore a correctness bug, not just
 * hydration noise: the server and the browser can disagree about the rendered
 * string, React reports a mismatch, and a price silently changes shape depending
 * on who loaded it. Every formatter below passes the locale explicitly.
 *
 * ---------------------------------------------------------------------------
 * What is deliberately absent
 * ---------------------------------------------------------------------------
 * No currency selector, no conversion, no exchange rate. Inventing a rate would be
 * inventing a price, and a converted figure nobody agreed to is a number the
 * business cannot honour. A price is either confirmed in USD or it is `null`, and
 * `null` renders as words rather than a number.
 */

/** Pinned for the reasons above. Never replace with the runtime default. */
const LOCALE = "en-US";

/**
 * The one price string this site is allowed to render.
 *
 * ---------------------------------------------------------------------------
 * The rules, in priority order
 * ---------------------------------------------------------------------------
 * 1. `status === "sold"` renders "Sold". A sold car is not for sale at any
 *    figure, and printing a price beside the word "Sold" invites the reading that
 *    the figure is still negotiable. The status wins.
 * 2. A price that is not a real asking price renders "Price on request". That
 *    covers `null`, and also `0` or a negative figure - see below.
 * 3. Otherwise the actual figure, grouped, in USD, with no decimals.
 *
 * ---------------------------------------------------------------------------
 * Why a zero price is treated as absent rather than rendered
 * ---------------------------------------------------------------------------
 * `price` is typed `number | null`, which means `0` and `-5000` type-check
 * perfectly well. Nothing in the type system stops them arriving, and once a
 * real endpoint feeds this seam it will be a third party we do not control - a
 * `NOT NULL` price column that was never filled in surfaces as `0` in most
 * stacks, and that is the single most damaging thing this page could render.
 *
 * "$0" on a used car is not a discount. Read by a customer it is either a
 * mistake or a joke, and it is the one price on this site that is guaranteed to
 * be wrong. "Price on request" is the honest reading of a missing figure and is
 * a real enquiry path, so a bad value degrades into a true statement.
 *
 * The alternative - trusting the data and rendering the literal figure - was
 * considered and rejected, because the argument for it ("never quietly
 * relabelling real data") assumes zero is real data. For an asking price on a
 * vehicle it never is.
 *
 * A negative price is treated identically. It has no meaning at all, and it is
 * included in the same guard so the condition cannot be defeated by a bad
 * upstream value in a different direction.
 */
export function formatVehiclePrice(vehicle: Vehicle): string {
  if (vehicle.status === "sold") return "Sold";
  if (vehicle.price === null || vehicle.price <= 0) return "Price on request";

  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: vehicle.currency,
    maximumFractionDigits: 0,
  }).format(vehicle.price);
}

/**
 * Whether a real figure will be rendered for this vehicle.
 *
 * ---------------------------------------------------------------------------
 * Why this is a function and not an inline check
 * ---------------------------------------------------------------------------
 * `formatVehiclePrice` returns a *number* or a *phrase* - "Sold" and "Price on
 * request" are sentences, not figures. That makes it unsafe to interpolate
 * straight into a sentence: `"Listed at " + formatVehiclePrice(sold)` produces
 * the literal string "Listed at Sold", which is nonsense in a meta description.
 *
 * Rather than repeat `status === "sold" || price === null` at every place that
 * wants to build a sentence about the price - the page metadata and the enquiry
 * panel both do - the condition lives here once. The two conditions drift apart
 * the moment a third availability state is added, and the failure is a customer
 * seeing nonsense in a search result rather than an error anyone would catch in
 * review.
 *
 * The guard is `price > 0`, not `price !== null`, and it has to match
 * `formatVehiclePrice` exactly. If these two disagree, the failure mode is a
 * description reading "Listed at Price on request" - which reintroduces exactly
 * the bug this function was written to prevent, one layer up.
 *
 * So: call this before writing the formatter's output into a sentence.
 */
export function hasQuotedPrice(vehicle: Vehicle): boolean {
  return vehicle.status !== "sold" && vehicle.price !== null && vehicle.price > 0;
}

/**
 * Odometer reading, grouped for readability.
 *
 * `tnum` is applied by the caller: these are figures a buyer compares down a
 * column of listings, which is the case the design system reserves tabular
 * numerals for. The unit is spelled out rather than abbreviated so the value
 * still reads correctly if a stylesheet fails to load.
 */
export function formatMileage(km: number): string {
  return `${new Intl.NumberFormat(LOCALE).format(km)} km`;
}

/**
 * "Toyota Land Cruiser" - the make and model, which is what a listing is.
 *
 * The variant is deliberately excluded. It is a separate, optional line in both
 * the card and the detail page, and folding it in here would make a long trim
 * name part of the title in one place and not the other.
 */
export function vehicleTitle(vehicle: Vehicle): string {
  return `${vehicle.make} ${vehicle.model}`;
}

/**
 * The vehicle's name including its year, used where the year is inseparable from
 * the name - page titles, and the pre-filled enquiry message.
 */
export function vehicleTitleWithYear(vehicle: Vehicle): string {
  return `${vehicle.year} ${vehicleTitle(vehicle)}`;
}

/**
 * The one function that builds a vehicle URL.
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 * ---------------------------------------------------------------------------
 * A vehicle has exactly one address. The card that links to it, the breadcrumb
 * that names it, `generateMetadata`'s `alternates.canonical` and the
 * `generateStaticParams` list all have to agree, and the way they are guaranteed
 * to agree is that they are not each building the string themselves.
 *
 * With the route in place, "one URL per vehicle" stops being a convention that
 * four call sites have to respect and becomes a type-level property: this is the
 * only place the pattern appears, so there is nothing to keep in sync.
 */
export function vehiclePath(slug: string): `/inventory/${string}` {
  return `/inventory/${slug}`;
}
