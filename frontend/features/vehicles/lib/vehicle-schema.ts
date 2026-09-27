/**
 * The vehicle data boundary.
 *
 * ---------------------------------------------------------------------------
 * What this file is for
 * ---------------------------------------------------------------------------
 * The moment `listVehicles()` becomes a real request, two things become true
 * that are not true today:
 *
 * 1. `Vehicle` stops being guaranteed. It is a TypeScript interface, and
 *    interfaces are erased at runtime. A response of `{"make": null}` satisfies
 *    nothing at all while still being a perfectly good JSON object.
 * 2. The backend becomes a second author of this domain. It will be maintained
 *    by someone else, on a different schedule, and it will eventually send a
 *    field this frontend has never heard of.
 *
 * Both of those are ordinary facts about integrating with another system, and
 * both have the same consequence if left unhandled: a customer sees a blank
 * price, a broken photograph, or a specification row that says nothing.
 *
 * So every record is checked here, once, on the way in. What reaches
 * `VehicleCard`, the grid and the detail page is a value this file has already
 * vouched for, and a record that cannot be vouched for is dropped rather than
 * rendered.
 *
 * ---------------------------------------------------------------------------
 * The guiding decision: normalise the fixable, reject the unfixable
 * ---------------------------------------------------------------------------
 * There are two sensible reactions to a bad field, and mixing them up is how a
 * data layer becomes unpredictable.
 *
 * *Normalise* a field that is present but messy - a slug in the wrong case, a
 * stray space in a trim level, a `0` price. The customer is better served by the
 * cleaned-up value than by a missing car, and nothing about the cleanup is a
 * guess.
 *
 * *Reject* a field that would require inventing something - an unknown
 * availability status, a currency this site cannot quote, a make or model that
 * is simply absent. There is no honest way to render those, so a vehicle missing
 * one of them is dropped instead.
 *
 * The distinction is whether a correct value can be derived from what is
 * already there. A slug can be lower-cased without inventing anything. An
 * unknown status cannot be turned into a real one without guessing.
 *
 * ---------------------------------------------------------------------------
 * No dependency
 * ---------------------------------------------------------------------------
 * This is hand-written for the same reason `lib/whatsapp.ts` is: the project
 * already has a precedent of solving a small, total problem with a small, total
 * function and pinning it with tests. A schema library would be a dependency
 * whose only job is to express what these forty lines already say, and every
 * rule here has a specific reason attached to it that a generic validator
 * could not carry.
 */

import type { Vehicle, VehicleImage, VehicleStatus } from "@/types/vehicle";
import type { VehicleRecord } from "@/lib/api/vehicles";

/**
 * Availability states the UI knows how to render.
 *
 * Mirrors `Vehicle["status"]`. An unrecognised value is rejected rather than
 * defaulted - see the note on `toVehicle`.
 */
const VEHICLE_STATUSES: readonly VehicleStatus[] = ["available", "reserved", "sold"];

/**
 * The VIN alphabet, which excludes I, O and Q.
 *
 * Those three letters are excluded by the standard precisely because they are
 * confusable with 1 and 0 in a hand-transcribed value, so a "VIN" containing
 * one is a misreading rather than a VIN. Rejecting it protects the customer from
 * being shown a number that cannot identify a vehicle.
 */
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/i;

/** First year a motor vehicle could plausibly be a "model year". */
const EARLIEST_MODEL_YEAR = 1900;

/** The current year is evaluated per call, not at module load. */
function latestPlausibleModelYear(): number {
  return new Date().getFullYear() + 1;
}

/** Result of normalising a batch. */
export interface NormalisedInventory {
  /** Records that passed every check, in source order. */
  vehicles: Vehicle[];
  /**
   * Records that were dropped entirely.
   *
   * Exposed rather than logged so it is observable and testable. A non-zero
   * count means the backend and this frontend disagree, which is worth knowing
   * before a customer reports a missing car.
   */
  rejected: number;
}

/* -------------------------------------------------------------------------
 * Primitives
 *
 * Each returns `null` for "absent or unusable" so the field rules below read as
 * a list of decisions rather than a pile of type guards.
 * ---------------------------------------------------------------------- */

/** A trimmed, non-empty string, or `null`. */
function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** A finite number, or `null`. Rejects `NaN`, `Infinity` and numeric strings. */
function number(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

/**
 * A slug, normalised into the one shape a URL path segment can hold.
 *
 * Lower-cased, whitespace/underscores/slashes folded to hyphens, and anything
 * that would require percent-encoding removed. `getVehicleBySlug()` compares
 * lower-cased on both sides, so normalising here is what makes an incoming
 * request match the stored value rather than depending on the database having
 * been written tidily.
 *
 * This normalises an existing slug. It never *invents* one: a record with no
 * slug is rejected, because `types/vehicle.ts` is explicit that the slug is
 * stored rather than derived from make and model, and a derived slug changes
 * every link to the vehicle when the make is corrected.
 */
function slug(value: unknown): string | null {
  const raw = text(value);
  if (raw === null) return null;

  const cleaned = raw
    .toLowerCase()
    .replace(/[\s_/]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned.length > 0 ? cleaned : null;
}

/**
 * A price, or `null` when there is no price to quote.
 *
 * Enforces the same rule as `formatVehiclePrice()`: a value of `<= 0` is not a
 * price. Normalising it to `null` here rather than leaving it for the formatter
 * means the whole system agrees on one meaning, and `null` is the only value
 * that means "not priced" anywhere in the codebase.
 */
function price(value: unknown): number | null {
  const amount = number(value);
  return amount !== null && amount > 0 ? amount : null;
}

/** An odometer reading, or `null`. A negative reading is not a reading. */
function mileage(value: unknown): number | null {
  const km = number(value);
  return km !== null && km >= 0 ? km : null;
}

/** A model year within a plausible range, or `null`. */
function year(value: unknown): number | null {
  const y = number(value);
  if (y === null || !Number.isInteger(y)) return null;
  if (y < EARLIEST_MODEL_YEAR || y > latestPlausibleModelYear()) return null;
  return y;
}

/** A VIN that conforms to the standard, or `null` when not recorded. */
function vin(value: unknown): string | null {
  const candidate = text(value);
  return candidate !== null && VIN_PATTERN.test(candidate) ? candidate : null;
}

/**
 * An availability state, or `null` when the backend named one this frontend
 * does not know.
 *
 * `null` means "reject the vehicle", not "assume available". Defaulting an
 * unrecognised status to `available` would be inventing availability - it would
 * tell a customer a car is for sale on the strength of a value the frontend did
 * not understand, which is the single most damaging thing this layer could do.
 * A car whose status has grown a fourth state is a bug to surface, not to paper
 * over.
 */
function status(value: unknown): VehicleStatus | null {
  const raw = text(value);
  if (raw === null) return null;
  const lowered = raw.toLowerCase();
  return VEHICLE_STATUSES.find((known) => known === lowered) ?? null;
}

/**
 * An image source this project can actually render.
 *
 * `next/image` can only be given a root-relative path or an absolute http(s)
 * URL; anything else is either broken or, in the case of a `javascript:` source,
 * a script injection into an `<img src>`. Remote hosts additionally have to be
 * allow-listed in `next.config.ts`, which is a deployment concern rather than a
 * data one - but the shape of the value is checkable here, so it is checked.
 */
function imageSource(value: unknown): string | null {
  const src = text(value);
  if (src === null) return null;
  if (src.startsWith("/")) return src;
  if (/^https?:\/\/[^\s]+$/i.test(src)) return src;
  return null;
}

/**
 * One photograph, or `null` when it cannot be shown honestly.
 *
 * All four fields are required together. In particular there is no fallback alt
 * text: a photograph with no description is inaccessible, and inventing a
 * description from the vehicle's name would be a claim about an image nobody
 * looked at. An undescribed photograph is dropped, and the vehicle falls back to
 * the neutral placeholder - which is honest, where a fabricated caption is not.
 */
function image(value: unknown): VehicleImage | null {
  if (typeof value !== "object" || value === null) return null;
  const raw = value as Record<string, unknown>;

  const src = imageSource(raw.src);
  const alt = text(raw.alt);
  if (src === null || alt === null) return null;

  const width = number(raw.width);
  const height = number(raw.height);
  if (width === null || height === null || width <= 0 || height <= 0) return null;

  return { src, alt, width, height };
}

/** Ordered photographs, with unusable entries dropped. Never `null`. */
function images(value: unknown): VehicleImage[] {
  if (!Array.isArray(value)) return [];
  return value.map(image).filter((entry): entry is VehicleImage => entry !== null);
}

/**
 * The free-form specification set, keeping only string values.
 *
 * A non-string value here is a backend modelling decision that has not reached
 * this frontend. Dropping the entry keeps the vehicle renderable and makes the
 * gap visible as a missing row rather than as `[object Object]`.
 */
function features(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};

  const collected: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const name = text(key);
    const description = text(raw);
    if (name !== null && description !== null) collected[name] = description;
  }
  return collected;
}

/**
 * Converts one wire record into a domain `Vehicle`, or `null` if it cannot be
 * represented honestly.
 *
 * ---------------------------------------------------------------------------
 * The rejection rules, and why each one rejects rather than defaults
 * ---------------------------------------------------------------------------
 * - **No id** - nothing can address or track the vehicle.
 * - **No usable slug** - there is no URL for it. See `slug()`.
 * - **No make or model** - a vehicle listing without a make and model is not
 *   identifiable. These are the two fields the customer scans for; there is no
 *   placeholder that would not be a fabrication.
 * - **No usable year** - a vehicle needs a model year to be compared.
 * - **Currency other than USD** - this site quotes USD and only USD. A figure in
 *   another currency has no correct rendering here, because converting it would
 *   mean inventing a rate. Rejecting is the only honest option, and it is also
 *   what makes the USD-only rule enforceable at the boundary rather than merely
 *   documented.
 * - **Unknown availability** - see `status()`.
 *
 * Everything else is normalised to `null` when absent, which is how the
 * renderers already expect to find it: a missing specification becomes no row at
 * all, rather than a dash, a zero or an invented default.
 */
export function toVehicle(record: unknown): Vehicle | null {
  if (typeof record !== "object" || record === null || Array.isArray(record)) return null;
  const raw = record as Partial<VehicleRecord> & Record<string, unknown>;

  const id = text(raw.id);
  const vehicleSlug = slug(raw.slug);
  const make = text(raw.make);
  const model = text(raw.model);
  const modelYear = year(raw.year);
  const currency = text(raw.currency)?.toUpperCase() ?? null;
  const availability = status(raw.status);

  // The USD gate. Placed with the other hard requirements because it is one: a
  // price we cannot quote in the only currency this site uses is not a price this
  // site can show.
  if (currency !== "USD") return null;

  if (id === null || vehicleSlug === null) return null;
  if (make === null || model === null || modelYear === null) return null;
  if (availability === null) return null;

  return {
    id,
    slug: vehicleSlug,
    make,
    model,
    variant: text(raw.variant),
    year: modelYear,
    bodyType: text(raw.body_type),
    transmission: text(raw.transmission),
    fuel: text(raw.fuel),
    colour: text(raw.colour),
    mileage: mileage(raw.mileage_km),
    vin: vin(raw.vin),
    price: price(raw.price),
    currency: "USD",
    status: availability,
    location: text(raw.location),
    images: images(raw.images),
    features: features(raw.features),
  };
}

/**
 * Converts a batch, dropping records that cannot be represented.
 *
 * A single malformed record must not cost the site the rest of the inventory:
 * one bad row from the backend should cost one car, not the page. That is why
 * this is a filter rather than an all-or-nothing parse.
 */
export function toVehicles(records: unknown): NormalisedInventory {
  if (!Array.isArray(records)) return { vehicles: [], rejected: 0 };

  const vehicles: Vehicle[] = [];
  let rejected = 0;

  for (const record of records) {
    const vehicle = toVehicle(record);
    if (vehicle === null) rejected += 1;
    else vehicles.push(vehicle);
  }

  return { vehicles, rejected };
}

/**
 * Unwraps the backend's `Page<T>` envelope into vehicles.
 *
 * Tolerates a bare array as well, so a backend that serves the list without the
 * envelope yet still renders. The pagination counts are preserved in the result
 * rather than discarded: the backend caps a page at 100 rows, and the grid needs
 * to know whether it is showing everything long before a customer notices.
 */
export function toInventoryPage(payload: unknown): NormalisedInventory & {
  total: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
} {
  const envelope =
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;

  const items = envelope?.items;
  const { vehicles, rejected } = toVehicles(Array.isArray(items) ? items : payload);

  const total = number(envelope?.total) ?? vehicles.length;
  const page = number(envelope?.page) ?? 1;
  const totalPages = number(envelope?.total_pages) ?? 1;

  return {
    vehicles,
    rejected,
    total,
    page,
    totalPages,
    hasNextPage: page < totalPages,
  };
}
