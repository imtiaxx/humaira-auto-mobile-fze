/**
 * The vehicle model.
 *
 * ---------------------------------------------------------------------------
 * This is the project's own declared contract, not a new invention
 * ---------------------------------------------------------------------------
 * `docs/architecture.md` already specifies the `Vehicle` aggregate root for the
 * planned inventory schema:
 *
 *   "Vehicle will be the aggregate root, holding specification fields (brand,
 *    model, variant, year, mileage, transmission, fuel, body type, colour, vin,
 *    price, currency, availability), VehicleImage as an ordered child set with a
 *    designated primary image, and VehicleFeature as a key/value specification
 *    set."
 *
 * This file is the frontend mirror of that sentence, so the shape a component
 * expects today is the shape the backend will return when the schema is agreed.
 * Renaming a field here later is a deliberate API decision rather than a quiet
 * drift between the two halves of the repository.
 *
 * ---------------------------------------------------------------------------
 * Why almost everything is nullable
 * ---------------------------------------------------------------------------
 * Real inventory is incomplete. A car with no photograph, no price agreed yet, or
 * no VIN recorded is normal, not exceptional. Making those fields `null` rather
 * than `""` or `0` means the compiler forces every rendering site to decide what
 * to do with absence, which is exactly the decision that is easy to get wrong
 * and dishonest to get wrong: `price: 0` renders as "$0" on a car that has
 * simply not been priced, and `mileage: 0` claims a showroom car has never been
 * driven.
 *
 * ---------------------------------------------------------------------------
 * `make` vs the database's `brand`
 * ---------------------------------------------------------------------------
 * The architecture document names the column `brand` but lists the filter
 * dimension as "make", and all customer-facing copy in this repository says
 * "make" ("By make, model and budget"). This type uses `make` because it is the
 * display field, and the API mapper is the single place that has to reconcile
 * the two names. Doing that translation once, explicitly, is better than
 * sprinkling both spellings through the components.
 */

/**
 * Availability of a vehicle.
 *
 * Mirrors the `Badge` component's documented vehicle-state mapping, which is
 * where the tone for each of these is decided, so a "Reserved" vehicle cannot
 * come out a different colour on two different pages.
 */
export type VehicleStatus = "available" | "reserved" | "sold";

/**
 * A vehicle photograph.
 *
 * `alt` is required rather than optional and there is no `null`: a photograph
 * without alt text is inaccessible, and making the author supply it is how that
 * gets enforced. `width`/`height` are required so the card can reserve the exact
 * box before the image loads, which is what keeps a grid from reflowing as
 * images arrive.
 */
export interface VehicleImage {
  src: string;
  /**
   * Describes the photograph. Write what a sighted reader would take from the
   * image, not the vehicle's name, which is already the card's heading.
   */
  alt: string;
  width: number;
  height: number;
}

/** A single vehicle, as a listing tile or a detail page needs it. */
export interface Vehicle {
  /** Stable internal identifier. Never displayed. */
  id: string;
  /**
   * URL segment identifying this vehicle: `/inventory/<slug>`.
   *
   * ---------------------------------------------------------------------------
   * Why a slug and not the `id`
   * ---------------------------------------------------------------------------
   * `id` is an internal surrogate key and is never displayed; putting it in a URL
   * would leak it and would make addresses unreadable. A slug is the same
   * identifier in the one form customers see, share and bookmark.
   *
   * It is a stored field rather than something derived from make and model at
   * render time, and that is a deliberate constraint. A URL has to stay stable: if
   * the make is corrected from "Mercedes-Benz" to "Mercedes" the derived slug
   * changes, every link to the vehicle breaks, and search engines have to be told
   * to drop the old address. A stored slug is chosen once and never changes, which
   * is what makes `alternates.canonical` on the detail page trustworthy.
   *
   * Lowercase and hyphen-separated, with no trailing punctuation. Comparisons
   * normalise case and trimming so a hand-typed URL still resolves.
   */
  slug: string;
  make: string;
  model: string;
  /** Trim level, e.g. "L Limited". `null` when not recorded. */
  variant: string | null;
  /** Model year. */
  year: number;
  bodyType: string | null;
  /** e.g. "Automatic". `null` when not recorded. */
  transmission: string | null;
  /** e.g. "Petrol", "Diesel", "Hybrid", "Electric". `null` when not recorded. */
  fuel: string | null;
  colour: string | null;
  /** Odometer reading in kilometres. `null` when not recorded - never `0`. */
  mileage: number | null;
  /** 17-character VIN. `null` until a specific car is allocated. */
  vin: string | null;
  /**
   * Asking price in whole US dollars (35000, not cents), or `null` when the
   * price has not been agreed or is withheld. `null` means "enquire", not
   * "free".
   *
   * Whole units rather than minor units deliberately: minor units would require
   * every renderer to divide by 100, and one that forgets renders a car's price
   * a hundred times too high. Whole units cannot be misread that way.
   *
   * ---------------------------------------------------------------------------
   * A zero price is not a valid price
   * ---------------------------------------------------------------------------
   * The contract is "`null` or a positive figure", but a `number` cannot enforce
   * that, so a `0` from a badly-populated upstream column will type-check and
   * arrive. The display rule is therefore enforced where the damage would happen:
   * `formatVehiclePrice()` in `features/vehicles/lib/format.ts` treats any value
   * `<= 0` as unpriced and renders "Price on request". Keep those two in step -
   * the type records the intent, the formatter guarantees the output.
   */
  price: number | null;
  /**
   * The pricing currency, and the only one this site quotes.
   *
   * ---------------------------------------------------------------------------
   * Why this is a literal type rather than `string`
   * ---------------------------------------------------------------------------
   * USD is the business's decision for customer-facing vehicle prices, so this
   * is typed `"USD"` rather than a general ISO 4217 `string`. That turns the rule
   * from a convention into a compiler error: a mapper that receives an AED or EUR
   * figure from a future endpoint cannot widen this to `"AED"` without an explicit
   * type error at the point of the mistake, instead of quietly shipping a second
   * currency into the UI.
   *
   * There is no currency selector, no conversion and no exchange-rate source in
   * this repository, and inventing a rate would be inventing a price. A quoted
   * price is either confirmed in USD or it is `null`.
   *
   * Kept as a field on the model rather than a module constant so the value
   * travels with the data the way the rest of the specification does, and so the
   * API mapper has one obvious place to reconcile a source that reports a
   * different currency.
   */
  currency: "USD";
  status: VehicleStatus;
  /** Where the vehicle is, e.g. the Dubai showroom. `null` when not confirmed. */
  location: string | null;
  /**
   * Ordered, with the primary image first. Empty until real photography
   * exists, which the card renders as a neutral placeholder rather than as a
   * broken image.
   */
  images: VehicleImage[];
  /** Key/value specification set, mirroring the planned `VehicleFeature` table. */
  features: Record<string, string>;
}

/**
 * The filter contract for when inventory is published.
 *
 * ---------------------------------------------------------------------------
 * Declared now, deliberately unused
 * ---------------------------------------------------------------------------
 * These are exactly the dimensions `docs/architecture.md` names as indexed
 * columns - make, body type, fuel, transmission, price range, year range - plus
 * the free-text make/model search. Writing the interface down now means the
 * query string shape is decided before any control exists, and it is a
 * type-only declaration, so it costs nothing at runtime.
 *
 * There is **no filtering UI on the page**, and that is the important part.
 * With zero vehicles published, a search box or a set of dropdowns can only
 * either do nothing or filter an empty list, and a control that looks functional
 * and is not is worse than no control at all: it teaches a visitor the site is
 * broken. The interface exists so that the first real inventory has somewhere
 * to plug in, not so an empty page can pretend to be a catalogue.
 */
export interface VehicleFilters {
  /** Free text matched against make and model. */
  query?: string;
  make?: string;
  bodyType?: string;
  fuel?: string;
  transmission?: string;
  /** Inclusive bounds, in USD, the only currency `price` is quoted in. */
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  /** Restrict to a single availability state. */
  status?: VehicleStatus;
}
