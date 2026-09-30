/**
 * Data mapping for the showroom section.
 *
 * ---------------------------------------------------------------------------
 * Why mapping lives here and not in the component
 * ---------------------------------------------------------------------------
 * The card wants a flat, fully-formatted shape - `name`, `specs`, `price`,
 * `href` - all guaranteed to be display-ready strings. The data it comes from is
 * structured and partial: `mileage` is `number | null`, `transmission` is
 * `string | null`, `price` is `number | null`, and the vehicle's identity is split
 * across `make` and `model`.
 *
 * Turning that into display strings is a *decision* about absence - what does an
 * unpriced car say, what does a car with no transmission show - and it has to be
 * made in exactly one place. If the card decided it, then a second component
 * showing the same car would decide it differently, and the two would disagree on
 * screen about the same vehicle.
 *
 * So the rule is: the mapper decides, the card renders. `ShowroomCar` has no
 * nullable display fields, which is what makes that guarantee checkable by the
 * compiler.
 *
 * This module is deliberately free of JSX and of React, so it is a plain function
 * that can be unit-tested directly - see `showroom-cars.test.ts`.
 */

/**
 * ---------------------------------------------------------------------------
 * Why these imports are relative rather than `@/`-prefixed
 * ---------------------------------------------------------------------------
 * The `@/` alias is a TypeScript-only construct: `tsconfig.json` maps it, and
 * `moduleResolution: "bundler"` resolves it for `tsc` and for Next. Node's test
 * runner knows nothing about it.
 *
 * Every other unit test in this project gets away with importing across the
 * alias because they only ever import *types* from it - `import type` is erased
 * during type stripping, so Node never has to resolve the specifier at all. This
 * module imports real functions, so the specifier survives into the runtime graph
 * and Node fails on it.
 *
 * So the two value imports below are relative and carry an explicit `.ts`
 * extension. That is the same concession `tsconfig.json` already documents and
 * permits for the test files, and it is what lets this file - which is the part of
 * the section with all the judgement in it - be unit tested on the built-in
 * runner. Adding a resolver or an alias loader to avoid two relative paths would
 * be a dependency for a cosmetic preference.
 */

import {
  formatMileage,
  formatVehiclePrice,
  vehiclePath,
  vehicleTitle,
} from "../../vehicles/lib/format.ts";
import type { Vehicle } from "../../../types/vehicle.ts";

/** New or pre-owned. Drives the badge and which tab a card appears under. */
export type CarType = "new" | "used";

/**
 * One car, display-ready.
 *
 * Every field is a non-null string (or `null` for `image` only, which has a
 * documented visual fallback). That is the whole point of this type: the card
 * cannot render `undefined` because nothing here can be `undefined`.
 */
export interface ShowroomCar {
  /** Stable key for React and for the tab split. Never displayed. */
  id: string;
  /** "Toyota Land Cruiser Prado". */
  name: string;
  type: CarType;
  /**
   * Photograph URL, or `null` when there is none.
   *
   * `null` is a normal state, not an error: real inventory is frequently
   * unphotographed, and the card draws a dark placeholder for it rather than
   * pretending a photograph is on its way.
   */
  image: string | null;
  /** Pre-joined for display: "2022 · Diesel · Automatic · 48,000 km". */
  specs: string;
  /** Pre-formatted, or "Price on request". */
  price: string;
  /**
   * Whether `price` is a real figure. Drives the "Inspected" sub-label and lets
   * the card visually de-emphasise a withheld price rather than presenting an
   * offer as if it were a number.
   */
  priceKnown: boolean;
  /**
   * Absolute path to the vehicle's detail page, or `null` when the source data
   * has no slug to build one from.
   *
   * `null` rather than `""` for two reasons. It matches the `image` convention
   * above - absence is `null`, never a falsy string that a caller has to
   * remember to test for. And an empty string is not a route at all, so typing it
   * as one would be a lie the compiler would eventually catch anyway.
   *
   * Typed as the template `` `/inventory/${string}` `` rather than as `Route`,
   * which is what `navigation/config.ts` uses for static nav entries. `Route` is a
   * closed union of the paths Next has generated types for, and it rejects a
   * template literal - so a per-vehicle path built at runtime from a slug cannot
   * be expressed as `Route`. `vehiclePath()` returns this same type, and
   * `next/link` accepts it, so this is the narrowest type that is both true and
   * usable.
   */
  href: `/inventory/${string}` | null;
}

/** Shown instead of a number when the price is not known. */
export const PRICE_ON_REQUEST = "Price on request";

/**
 * Joins the parts that exist, dropping the ones that do not.
 *
 * A car with no transmission should show "2022 · Diesel", not "2022 ·  · Diesel"
 * and not "2022 · Unknown". Both of those look like a bug, and the first one also
 * breaks the visual rhythm of the specs line across a grid of cards.
 *
 * The separator is a real middot character rather than a CSS pseudo-element so
 * the line still reads correctly if the styling fails to load.
 */
function joinSpecs(parts: readonly (string | null | undefined)[]): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(" · ");
}

/**
 * The shape the section received before this refactor.
 *
 * Declared here rather than imported from the component so the mapper is not
 * coupled to a client component that owns presentation. The field names are the
 * awkward ones the refactor was asked to fix - `title`/`subtitle` with the model
 * repeated in both, and a `price` of "Request Price" that is really a sentinel
 * for "unknown".
 */
export interface LegacyShowroomCar {
  id: string;
  title: string;
  /**
   * Free-text run-on such as "hilux 0 mi 18/100 Automatic". Deliberately ignored
   * by the mapper - see `toShowroomCars`.
   */
  subtitle: string;
  mileage: string;
  transmission: string;
  price: string;
  images: string[];
  status: CarType;
}

/**
 * Recognises the "unknown price" sentinels the old data used.
 *
 * The old value was the button label "Request Price" in the price slot, which is
 * why the section read oddly: the number a visitor reads was phrased as a button.
 * Matching on the word rather than on a sentinel value keeps this tolerant of the
 * small copy variations the data has had.
 */
const UNPRICED = /^(request price|price on request|on request|poa|ask)$/i;

/**
 * Converts the section's existing data into `ShowroomCar`.
 *
 * Note what is *dropped*:
 *
 * - `subtitle` is ignored entirely. It duplicated the model name and ran three
 *   unrelated facts together with no separator ("hilux 0 mi 18/100 Automatic"),
 *   which is most of what made the cards look unfinished. The same facts are
 *   rebuilt from the structured fields below, in a defined order.
 * - `title` keeps only the model line. Where the old data repeated the name on
 *   two lines, that repetition is what produced the "unpolished" reading.
 */
export function toShowroomCars(cars: readonly LegacyShowroomCar[]): ShowroomCar[] {
  return cars.map((car) => {
    const priceKnown = !UNPRICED.test(car.price.trim());

    return {
      id: car.id,
      name: car.title.trim(),
      type: car.status,
      image: car.images[0] ?? null,
      // Mileage first, then transmission - the two facts a buyer scans for.
      specs: joinSpecs([car.mileage, car.transmission]),
      price: priceKnown ? car.price.trim() : PRICE_ON_REQUEST,
      priceKnown,
      // The legacy rows have no slug, so they cannot deep-link. `null` is handled
      // by the card, which then renders a non-interactive card rather than an
      // anchor to nowhere.
      href: null,
    };
  });
}

/**
 * Converts real API vehicles into `ShowroomCar`.
 *
 * This is the mapper that matters long-term, because it is the one that will
 * survive: the section should read from `/api/v1/vehicles` rather than from a
 * hard-coded array.
 *
 * ---------------------------------------------------------------------------
 * The one gap: new vs used is not in the API yet
 * ---------------------------------------------------------------------------
 * `Vehicle.status` is `available | reserved | sold` - an *availability* state, not
 * a *condition*. There is no `condition: "new" | "used"` field on the type or in
 * the database, so this mapper cannot derive the tab a car belongs to.
 *
 * Rather than guess - and guessing would silently file a brand-new car under
 * "Used" - `resolveType` is a required argument. When the field is added to the
 * schema, this becomes `(vehicle) => vehicle.condition === "new" ? "new" : "used"`
 * and the call site changes by one line. In the meantime the caller passes
 * whatever it actually knows.
 */
export function fromVehicles(
  vehicles: readonly Vehicle[],
  resolveType: (vehicle: Vehicle) => CarType,
): ShowroomCar[] {
  return vehicles.map((vehicle) => {
    const image = vehicle.images[0] ?? null;

    return {
      id: vehicle.id,
      name: vehicleTitle(vehicle),
      type: resolveType(vehicle),
      image: image ? image.src : null,
      // Reuses the project's own formatters rather than re-deriving them, so this
      // section and `/inventory` cannot disagree about how a mileage or a price
      // is written. `formatMileage` is skipped when `mileage` is `null` because
      // the column is nullable and `0` is a real odometer reading - showing
      // "0 km" for a car whose mileage was never recorded would be a lie.
      specs: joinSpecs([
        String(vehicle.year),
        vehicle.fuel,
        vehicle.transmission,
        vehicle.mileage === null ? null : formatMileage(vehicle.mileage),
      ]),
      price: formatVehiclePrice(vehicle),
      // `formatVehiclePrice` renders "Price on request" for `null` and for `<= 0`,
      // and a sold vehicle's own label. Re-deriving "is this a number" by string
      // comparison would be fragile, so the intent is checked from the data.
      priceKnown:
        vehicle.price !== null && vehicle.price > 0 && vehicle.status !== "sold",
      href: vehiclePath(vehicle.slug),
    };
  });
}

/** Counts per tab, so the section can label a tab without filtering twice. */
export function countByType(cars: readonly ShowroomCar[]): Record<CarType, number> {
  return {
    new: cars.filter((car) => car.type === "new").length,
    used: cars.filter((car) => car.type === "used").length,
  };
}
