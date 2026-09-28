/**
 * The brand directory, derived from published stock.
 *
 * ---------------------------------------------------------------------------
 * What this is for
 * ---------------------------------------------------------------------------
 * `navigation/config.ts` has declared `Brands` as a `planned` destination at
 * `/brands` since the global shell was built, as the first planned item in the
 * primary nav - the order a first-time visitor scans. This module is the data
 * behind that page.
 *
 * ---------------------------------------------------------------------------
 * Why it is derived, and not a table
 * ---------------------------------------------------------------------------
 * The obvious implementation is a constant: `const BRANDS = ["Toyota", "Nissan",
 * "Mercedes-Benz"]`, and it is wrong three separate ways.
 *
 *   1. It is a claim about what the dealership stocks, written down by
 *      hand. Publish a Land Cruiser and add one to the list; archive the last
 *      Patrol and remember to remove it. A brand page that lists a make with no
 *      vehicles sends a customer to an empty result, and one that omits a make
 *      with nine cars in stock is simply wrong.
 *   2. The live inventory contains `Mercedes-Benz`, `Nissan` and `Toyota` -
 *      three spellings a hand-written list would almost certainly get wrong in
 *      the hyphen, exactly as `facets.ts` documents.
 *   3. A count, a model list and a price range are not hand-maintainable at all.
 *      They change every time a car is published or archived, which is the one
 *      thing staff do routinely.
 *
 * So the directory is a projection of the published set, the same call
 * `toVehicleFacets` makes for the filter dropdowns. An option can never exist
 * here that the inventory endpoint cannot satisfy, and a recorded make cannot be
 * unreachable. The live data is the source; this file only shapes it.
 *
 * ---------------------------------------------------------------------------
 * Why it lives in `features/` and not `types/` or `app/`
 * ---------------------------------------------------------------------------
 * `docs/architecture.md` restricts `types/` to "types mirroring the API
 * contract" and `app/` to routing with "no business logic", while `features/` is
 * "feature-scoped components and logic". A `Brand` here describes a *projection
 * of the catalogue*, not a resource the API serves, so it belongs in the feature
 * beside `VehicleFacets` and not in the shared type layer or in the route.
 *
 * ---------------------------------------------------------------------------
 * The trade this makes, stated plainly
 * ---------------------------------------------------------------------------
 * Grouping 13 vehicles in JavaScript costs nothing. Grouping 50,000 would mean
 * the page walks the whole inventory - up to `MAX_PAGES` requests - to produce
 * three numbers, which is the same cost `listVehicles` already pays and the same
 * trade the facets take. A dedicated aggregate endpoint is the answer when the
 * catalogue outgrows it, and naming it now means the shape of this function is
 * the seam that endpoint would replace rather than a rewrite of the page.
 */

import type { Vehicle } from "@/types/vehicle";

/** One make, as published stock records it. */
export interface Brand {
  /**
   * The make exactly as the database spells it, not a normalised or prettified
   * form. The backend matches `make` case-insensitively, so the displayed value
   * can be the readable one, but the *value sent* has to be one the endpoint has
   * heard of - and normalising it here would mean the label and the filter
   * disagree.
   */
  readonly name: string;
  /** Published, non-archived vehicles with this make. */
  readonly count: number;
  /** Distinct models stocked, alphabetically. Never empty when `count` is not. */
  readonly models: readonly string[];
  /** Cheapest published price, or `null` when nothing is priced. */
  readonly minPrice: number | null;
  /** Dearest published price, or `null` when nothing is priced. */
  readonly maxPrice: number | null;
}

/**
 * The mutable form of a `Brand`, used only while accumulating.
 *
 * Separate from the public interface because the two have different jobs: this
 * one is edited in a loop, the other is a finished value. Exposing `Brand` as
 * `readonly` and casting away the readonly-ness to mutate it would be a lie
 * about the code, and making the *public* type mutable instead would let a caller
 * edit a directory and invalidate the counts and bounds the tests pin. So the
 * build happens in a private shape and the public type is only ever the result.
 */
interface Accumulator {
  name: string;
  count: number;
  models: string[];
  minPrice: number | null;
  maxPrice: number | null;
}

/**
 * Two names treated as the same one.
 *
 * Case-insensitive, so `Toyota` and `toyota` are one entry rather than two that
 * look identical in the list, and `X250d` and `x250d` are one model rather than
 * the same model written twice. Keeps the *first* spelling encountered, which is
 * the repository's own, rather than inventing a preferred casing.
 *
 * Applied to models as well as makes because the backend matches both
 * case-insensitively - so "toyota" and "Toyota" are already the same brand
 * everywhere else in the system, and this page should not be the one place they
 * differ.
 */
function sameName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Groups published vehicles into the brand directory.
 *
 * Pure: no fetch, no clock, no globals. Same contract as `toVehicleFacets`, and
 * for the same reason - it is the half of this feature that can be tested at all.
 */
export function toBrandDirectory(vehicles: readonly Vehicle[]): Brand[] {
  const brands: Accumulator[] = [];

  for (const vehicle of vehicles) {
    // A make is a required, non-blank field on `Vehicle`, so there is no
    // absence to handle here the way `facets.ts` handles a missing fuel type. The
    // guard is a statement about the type, not a recovery path: if the normaliser
    // in `vehicle-schema.ts` ever stopped rejecting a blank make, this would
    // produce one nameless entry rather than an entry labelled "".
    if (vehicle.make.trim() === "") continue;

    // Resolved once, before it is used. Reading `vehicle.price` at each use would
    // pass a `number | null` into functions that have already decided what an
    // absent price means, and narrowing it here is what removes that.
    const price = pricedValue(vehicle.price);
    const existing = brands.find((brand) => sameName(brand.name, vehicle.make));

    if (existing === undefined) {
      brands.push({
        name: vehicle.make,
        count: 1,
        models: [vehicle.model],
        minPrice: price,
        maxPrice: price,
      });
      continue;
    }

    existing.count += 1;

    /*
      Models merge case-insensitively too, for the reason makes do. The list is
      rendered as one comma-separated sentence, and `Hilux, hilux` in the same
      breath is a visible data-entry fault on a page whose entire claim is that
      every fact on it came from the inventory. First spelling wins, so the
      repository's own casing is what the customer reads.
    */
    if (!existing.models.some((model) => sameName(model, vehicle.model))) {
      existing.models.push(vehicle.model);
    }

    if (price !== null) {
      existing.minPrice = lowerOf(existing.minPrice, price);
      existing.maxPrice = higherOf(existing.maxPrice, price);
    }
  }

  for (const brand of brands) {
    brand.models.sort((a, b) => a.localeCompare(b));
  }

  // Locale-aware, for the reason `facets.ts` gives: a case-sensitive sort puts
  // lowercase entries after uppercase ones and the list stops reading as a list.
  return brands.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The published price, or `null` when there is not a usable one.
 *
 * `null` and a non-positive figure are both "no price stated", the same call
 * `formatVehiclePrice` makes when it renders "Price on request". Letting a `0`
 * through would make a brand's floor read $0, which is a claim nobody can
 * support and cheaper to not make.
 */
function pricedValue(price: number | null): number | null {
  return price === null || price <= 0 ? null : price;
}

function lowerOf(current: number | null, candidate: number): number {
  return current === null || candidate < current ? candidate : current;
}

function higherOf(current: number | null, candidate: number): number {
  return current === null || candidate > current ? candidate : current;
}

/**
 * The inventory link for one make.
 *
 * ---------------------------------------------------------------------------
 * Why the value is encoded
 * ---------------------------------------------------------------------------
 * This is a query string assembled in JavaScript, and `encodeURIComponent` is not
 * optional tidiness here. `Mercedes-Benz` happens to need no encoding, which is
 * exactly what makes it dangerous: the live inventory could contain a make like
 * `Land Rover & Co` or `Alfa Romeo`, and an unencoded `&` or space would produce
 * `/inventory?make=Land Rover & Co` - which the server reads as a make of
 * "Land Rover " plus a junk parameter. The link would still render, still look
 * right, and land the customer on an unfiltered inventory with no indication of
 * why. Encoding is what makes the make and the URL the same value.
 *
 * Typed as a template literal so the compiler checks the path against the
 * generated `Route` union, the same trick `vehiclePath` uses. `/brands` is a
 * real route and `?${string}` is an accepted suffix, so this is verified at
 * compile time rather than trusted.
 */
export function makePath(make: string): `/inventory?make=${string}` {
  return `/inventory?make=${encodeURIComponent(make)}`;
}
