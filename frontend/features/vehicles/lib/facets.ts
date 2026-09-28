/**
 * The filter options, derived from the vehicles actually published.
 *
 * ---------------------------------------------------------------------------
 * Why nothing here is a hard-coded list
 * ---------------------------------------------------------------------------
 * The obvious implementation is a constant: `const MAKES = ["Toyota", "Nissan",
 * ...]`. It is wrong here for two independent reasons, and the live inventory
 * demonstrates both.
 *
 * **1. It would invent a taxonomy.** The dealer records body type as `SUV`,
 * `Hatchback` and `pick up` - lowercase and two words, because that is how the
 * vehicles were entered. A hand-written list has to guess whether to offer
 * "Pickup", "Pick Up" or "pick up", and every guess that differs from the stored
 * value is a filter that silently returns nothing. A visitor who picks "Pickup"
 * from a list the database has never heard of concludes the site is broken, and
 * the control is truthful-looking while being fiction. Deriving the options from
 * the rows means an option always matches a stored value, and the moment staff
 * enter a body type the option appears with no code change.
 *
 * **2. It would invent stock.** The list would be frozen at the moment it was
 * written and would go stale the first time a car is sold, archived, or added -
 * offering a make with nothing in it, which is a promise the site cannot keep.
 * These options are recomputed per request from the same read the page already
 * performs, so they cannot go stale.
 *
 * `sourcing-criteria.tsx` said this in advance and is why its replacement is
 * built this way: the previous version refused to hard-code "a searchable set of
 * makes, a price range, a fuel taxonomy", calling that "a decision for when there
 * is real stock to categorise, not now". There is now, and the categorisation
 * comes from the stock.
 *
 * ---------------------------------------------------------------------------
 * What a `null` means, and why these lists are not "everything that could match"
 * ---------------------------------------------------------------------------
 * A vehicle with no recorded fuel is not a diesel, and one with no recorded body
 * type is not an SUV. The API already excludes `NULL` from every facet filter
 * (`vehicle_filter_clauses`), so offering "Unrecorded" as an option would be
 * offering a control that cannot be satisfied. The lists below contain only
 * values that exist, which is exactly the set of filters that can return
 * something.
 *
 * The same reasoning excludes unpriced vehicles from the price ceiling. Eleven of
 * the thirteen published vehicles have no price, and a "Maximum price" field
 * bounded by the most expensive *priced* vehicle is honest about that; a bound
 * derived by pretending the others are free would not be.
 */

import type { Vehicle } from "@/types/vehicle";

/** One selectable value, with the record count that currently carries it. */
export interface FacetOption {
  value: string;
  /** How many published vehicles match exactly. Never shown as a stock promise. */
  count: number;
}

export interface VehicleFacets {
  makes: FacetOption[];
  bodyTypes: FacetOption[];
  fuels: FacetOption[];
  transmissions: FacetOption[];
  /** Cheapest published price, for the lower bound's placeholder. `null` if none. */
  minPrice: number | null;
  /** Dearest published price, for the upper bound's placeholder. `null` if none. */
  maxPrice: number | null;
  /** Oldest published model year. `null` if none. */
  minYear: number | null;
  /** Newest published model year. `null` if none. */
  maxYear: number | null;
}

const EMPTY_FACETS: VehicleFacets = {
  makes: [],
  bodyTypes: [],
  fuels: [],
  transmissions: [],
  minPrice: null,
  maxPrice: null,
  minYear: null,
  maxYear: null,
};

/**
 * Collects the distinct, non-blank values of one field, with counts.
 *
 * Sorted case-insensitively, and that is not cosmetic: the real data holds
 * `SUV` and `pick up` in the same list, and a case-sensitive sort would put
 * `pick up` first because a lower-case `p` sorts after an upper-case `S` in
 * ASCII. The result would read as though the dealership had classified a pickup
 * before a sports utility. Comparison is by `localeCompare`, which handles case
 * the way a reader does, and the original spelling is what gets sent - the
 * backend matches case-insensitively, so nothing is lost by not normalising the
 * value itself.
 */
function optionsFrom(
  vehicles: readonly Vehicle[],
  pick: (vehicle: Vehicle) => string | null,
): FacetOption[] {
  const counts = new Map<string, { display: string; count: number }>();

  for (const vehicle of vehicles) {
    const value = pick(vehicle);
    if (value === null) continue;
    const trimmed = value.trim();
    // A blank string is absence in the same way `null` is. `vehicle-schema.ts`
    // normalises unrecorded specifications to `null`, so this only catches a
    // stored blank, and treating it as a selectable "make" would be a filter
    // that returns every vehicle instead of none.
    if (trimmed === "") continue;

    // Case-insensitive merge, so "SUV" and "suv" are one option rather than two
    // identical-looking entries in the same dropdown.
    const existing = counts.get(trimmed.toLowerCase());
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(trimmed.toLowerCase(), { display: trimmed, count: 1 });
    }
  }

  return [...counts.values()]
    .sort((a, b) => a.display.localeCompare(b.display))
    .map(({ display, count }) => ({ value: display, count }));
}

/**
 * Derives every filter option from the published inventory.
 *
 * Pure and synchronous, and takes the vehicles rather than fetching them: the
 * page has already read the inventory, and a function that fetched as well would
 * be a second read of a fact the caller is holding.
 */
export function toVehicleFacets(vehicles: readonly Vehicle[]): VehicleFacets {
  if (vehicles.length === 0) return EMPTY_FACETS;

  const prices: number[] = [];
  let minYear: number | null = null;
  let maxYear: number | null = null;

  for (const vehicle of vehicles) {
    // `price` is `number | null` and the domain formatter treats anything <= 0
    // as unpriced, so a non-positive value is excluded here for the same reason:
    // it would widen the price range with a figure that does not exist.
    if (typeof vehicle.price === "number" && vehicle.price > 0) {
      prices.push(vehicle.price);
    }

    if (Number.isFinite(vehicle.year)) {
      minYear = minYear === null ? vehicle.year : Math.min(minYear, vehicle.year);
      maxYear = maxYear === null ? vehicle.year : Math.max(maxYear, vehicle.year);
    }
  }

  return {
    makes: optionsFrom(vehicles, (v) => v.make),
    bodyTypes: optionsFrom(vehicles, (v) => v.bodyType),
    fuels: optionsFrom(vehicles, (v) => v.fuel),
    transmissions: optionsFrom(vehicles, (v) => v.transmission),
    minPrice: prices.length > 0 ? Math.min(...prices) : null,
    maxPrice: prices.length > 0 ? Math.max(...prices) : null,
    minYear,
    maxYear,
  };
}
