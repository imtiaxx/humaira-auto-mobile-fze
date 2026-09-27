/**
 * The staff data boundary.
 *
 * ---------------------------------------------------------------------------
 * Where this differs from `features/vehicles/lib/vehicle-schema.ts`
 * ---------------------------------------------------------------------------
 * The public normaliser **drops** a record it cannot vouch for and counts it in
 * `rejected`. That is the right call for a customer browsing stock: one malformed
 * car should not take a page down, and the count is there to be logged.
 *
 * It is the wrong call here. A staff member opening a vehicle to fix it, or to
 * find out why it vanished from the site, would get a blank page and no way to
 * tell a bad record from a permissions problem. The failure has to be *visible*,
 * and it has to say what was wrong, because the person who can fix it is the one
 * looking at the screen.
 *
 * So every parser here returns a `ParseResult` rather than a bare value or a
 * `null`. A caller cannot accidentally ignore the failure - it has to match on
 * `ok` - and the message names the field, which is the difference between
 * "something went wrong" and "this vehicle has a currency this admin cannot
 * edit".
 *
 * ---------------------------------------------------------------------------
 * The same two principles still apply
 * ---------------------------------------------------------------------------
 * *Normalise* what can be derived from what is there: a slug in the wrong case, a
 * VIN typed in lower case, whitespace around a price. The staff member gets the
 * corrected value on screen and the backend receives a tidy one.
 *
 * *Reject* what would require inventing something: an availability state this
 * admin does not know, a currency it cannot quote, a vehicle with no model year.
 * Guessing at any of those would mean writing a value to the database that nobody
 * chose.
 *
 * ---------------------------------------------------------------------------
 * No dependency, for the same reason as the public one
 * ---------------------------------------------------------------------------
 * Every rule below has a specific reason attached to it that a generic validator
 * could not carry, and the project has already settled the precedent of solving a
 * small, total problem with a small, total function and pinning it with tests.
 */

import type {
  InventorySummary,
  StaffUser,
  StaffVehicle,
  StaffVehicleImage,
  VehicleAvailability,
} from "@/types/staff";

/** Either a checked value, or a message naming what was wrong. */
export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** Builds a failed result. Named so the messages below all read alike. */
function fail<T>(error: string): ParseResult<T> {
  return { ok: false, error };
}

/** The three availability states the backend defines. */
const AVAILABILITY: readonly VehicleAvailability[] = ["available", "reserved", "sold"];

/**
 * The VIN alphabet, excluding I, O and Q.
 *
 * Those three are excluded by the standard because they are confusable with 1 and
 * 0 in a hand-transcribed value, so a "VIN" containing one is a misreading. The
 * backend stores a 17-character VIN without checking its alphabet, which means a
 * typo can reach this screen; rejecting it here turns that typo into a visible
 * error rather than a vehicle whose VIN is useless to a buyer.
 */
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/i;

/** First year a motor vehicle could plausibly be a "model year". */
const EARLIEST_MODEL_YEAR = 1900;

/** The current year is evaluated per call, not at module load. */
function latestPlausibleModelYear(): number {
  return new Date().getFullYear() + 1;
}

/* -------------------------------------------------------------------------
 * Primitives
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

/** Collapse internal runs of whitespace, matching the backend's own collapsing. */
function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * An ISO timestamp, or `null` when absent.
 *
 * Normalised to an ISO string so the editor and the image manager compare
 * timestamps as strings. The backend already emits UTC with an offset from
 * either database - that is what `as_utc()` in `app/utils/time.py` is for - so
 * the value that reaches here is unambiguous and does not need re-interpreting.
 */
function timestamp(value: unknown): string | null {
  const raw = text(value);
  if (raw === null) return null;
  return Number.isNaN(Date.parse(raw)) ? null : raw;
}

/**
 * An availability state, or `null` when the backend named one this admin does not
 * know.
 *
 * `null` here is an error, never a default. Defaulting an unrecognised status to
 * `available` would put a vehicle back into public sale on the strength of a value
 * nobody chose - and unlike the public site, where an unknown status merely hides
 * a car, here the form will eventually be saved and the guess written down.
 */
function availability(value: unknown): VehicleAvailability | null {
  const raw = text(value);
  if (raw === null) return null;
  return AVAILABILITY.find((known) => known === raw.toLowerCase()) ?? null;
}

/** A model year within a plausible range, or `null`. */
function modelYear(value: unknown): number | null {
  const year = number(value);
  if (year === null || !Number.isInteger(year)) return null;
  if (year < EARLIEST_MODEL_YEAR || year > latestPlausibleModelYear()) return null;
  return year;
}

/** A VIN conforming to the standard, upper-cased, or `null` when not recorded. */
function vin(value: unknown): string | null {
  const candidate = text(value);
  return candidate !== null && VIN_PATTERN.test(candidate) ? candidate.toUpperCase() : null;
}

/** A price, or `null` for "price on request". Zero is not a price. */
function price(value: unknown): number | null {
  const amount = number(value);
  return amount !== null && amount > 0 ? amount : null;
}

/** An odometer reading, or `null`. A negative reading is not a reading. */
function mileage(value: unknown): number | null {
  const km = number(value);
  return km !== null && km >= 0 ? km : null;
}

/* -------------------------------------------------------------------------
 * Staff
 * ---------------------------------------------------------------------- */

/**
 * A staff account.
 *
 * `full_name` and `email` are required here, so a header can render
 * `staff.fullName` with no fallback. The backend guarantees both are present, and
 * this is the place that would say so if one were not.
 */
export function parseStaffUser(value: unknown): ParseResult<StaffUser> {
  if (typeof value !== "object" || value === null) {
    return fail("The staff account was not an object.");
  }
  const raw = value as Record<string, unknown>;

  const id = text(raw.id);
  if (id === null) return fail("The staff account has no identifier.");

  const fullName = text(raw.full_name);
  if (fullName === null) return fail("The staff account has no name.");

  const email = text(raw.email);
  if (email === null) return fail("The staff account has no email address.");

  return {
    ok: true,
    value: {
      id,
      fullName: collapse(fullName),
      email,
      isStaff: raw.is_staff === true,
    },
  };
}

/* -------------------------------------------------------------------------
 * Images
 * ---------------------------------------------------------------------- */

/**
 * A photograph with its ordering.
 *
 * `alt` is required and non-empty. The backend refuses to store an image without
 * one, so an empty `alt` reaching this function means a row predates that rule or
 * was written by something that bypassed it - either way, a photo a screen reader
 * cannot describe, which is worth an error rather than a silent blank.
 *
 * The `src` check is the same one the public schema makes: a root-relative path
 * or an absolute http(s) URL, and nothing else, so a value that came from the
 * database cannot turn into a `javascript:` URL in an image tag.
 */
function image(value: unknown): StaffVehicleImage | string {
  if (typeof value !== "object" || value === null) return "image is not an object";

  const raw = value as Record<string, unknown>;

  const id = text(raw.id);
  if (id === null) return "image has no identifier";

  const src = text(raw.src);
  if (src === null) return "image has no source";
  if (!src.startsWith("/") && !/^https?:\/\/[^\s]+$/i.test(src)) {
    return "image source is neither a site-relative path nor an http(s) URL";
  }

  const alt = text(raw.alt);
  if (alt === null) return "image has no alt text";

  const width = number(raw.width);
  if (width === null || width <= 0) return "image has no usable width";

  const height = number(raw.height);
  if (height === null || height <= 0) return "image has no usable height";

  const position = number(raw.position);
  if (position === null || !Number.isInteger(position) || position < 0) {
    return "image has no usable position";
  }

  return { id, src, alt: collapse(alt), width, height, position };
}

/**
 * A whole gallery, sorted into display order.
 *
 * Sorted by `position` because the form and the image manager both render "the
 * first image is the lead photograph", and relying on the array order in a JSON
 * response is relying on something no contract guarantees. A stable sort on ties
 * keeps the render deterministic even if two images ever share a position.
 */
function images(value: unknown): StaffVehicleImage[] | string {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return "images is not a list";

  const parsed: StaffVehicleImage[] = [];
  for (const entry of value) {
    const result = image(entry);
    if (typeof result === "string") return result;
    parsed.push(result);
  }
  return parsed.sort((a, b) => a.position - b.position);
}

/* -------------------------------------------------------------------------
 * Vehicles
 * ---------------------------------------------------------------------- */

/**
 * Feature rows, as an ordered list.
 *
 * The wire shape is a JSON object, which cannot represent a duplicate label and
 * whose key order is not part of the contract. A list of pairs is what a form can
 * round-trip: the staff member can see the order, add a row, and remove one,
 * without two rows silently collapsing into a single key.
 */
function features(value: unknown): Array<{ name: string; value: string }> | string {
  if (value === undefined || value === null) return [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return "features is not a list of name and value pairs";
  }

  const rows: Array<{ name: string; value: string }> = [];
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const name = text(key);
    if (name === null) return "a feature has a blank name";

    const content = text(item);
    if (content === null) return `feature "${collapse(name)}" has no value`;

    rows.push({ name: collapse(name), value: collapse(content) });
  }
  return rows;
}

/**
 * A vehicle as the staff surface needs it.
 *
 * `currency` is checked against USD rather than merely carried through. The
 * backend has a CHECK constraint that should make this unreachable, and the public
 * normaliser can afford to only carry it - a car priced in an unexpected currency
 * is a rendering curiosity there. Here it is different: this is the one screen
 * where such a row would be *edited and saved*, and a form that silently
 * round-trips a value it cannot display is how a currency error gets made
 * permanent. It fails visibly instead.
 */
export function parseStaffVehicle(value: unknown): ParseResult<StaffVehicle> {
  if (typeof value !== "object" || value === null) {
    return fail("The vehicle was not an object.");
  }
  const raw = value as Record<string, unknown>;

  const id = text(raw.id);
  if (id === null) return fail("This vehicle has no identifier.");

  const slug = text(raw.slug);
  if (slug === null) return fail("This vehicle has no URL slug.");

  const make = text(raw.make);
  if (make === null) return fail("This vehicle has no make.");

  const model = text(raw.model);
  if (model === null) return fail("This vehicle has no model.");

  const year = modelYear(raw.year);
  if (year === null) return fail("This vehicle has no plausible model year.");

  const currency = text(raw.currency);
  if (currency !== "USD") {
    return fail(
      `This vehicle is priced in ${currency ?? "an unknown currency"}, which this admin cannot edit.`,
    );
  }

  const status = availability(raw.status);
  if (status === null) {
    return fail(`This vehicle has an availability state this admin does not recognise.`);
  }

  const pictureSet = images(raw.images);
  if (typeof pictureSet === "string") return fail(`This vehicle's photographs are unusable: ${pictureSet}.`);

  const featureRows = features(raw.features);
  if (typeof featureRows === "string") return fail(`This vehicle's features are unusable: ${featureRows}.`);

  return {
    ok: true,
    value: {
      id,
      slug: collapse(slug),
      make: collapse(make),
      model: collapse(model),
      variant: text(raw.variant) === null ? null : collapse(text(raw.variant) as string),
      year,
      bodyType: text(raw.body_type) === null ? null : collapse(text(raw.body_type) as string),
      transmission:
        text(raw.transmission) === null ? null : collapse(text(raw.transmission) as string),
      fuel: text(raw.fuel) === null ? null : collapse(text(raw.fuel) as string),
      colour: text(raw.colour) === null ? null : collapse(text(raw.colour) as string),
      mileageKm: mileage(raw.mileage_km),
      vin: vin(raw.vin),
      price: price(raw.price),
      currency: "USD",
      status,
      location: text(raw.location) === null ? null : collapse(text(raw.location) as string),
      archivedAt: timestamp(raw.archived_at),
      createdAt: timestamp(raw.created_at) ?? "",
      updatedAt: timestamp(raw.updated_at) ?? "",
      images: pictureSet,
      features: featureRows,
    },
  };
}

/**
 * Dashboard counts.
 *
 * A count that is not a non-negative integer is a bug worth surfacing, but unlike
 * the vehicle parser this one does not reject: the dashboard is a summary, and a
 * single unreadable count should not replace four readable ones with an error
 * page. Missing counts become `0`, which is the truthful reading of "the backend
 * did not report this".
 */
export function parseInventorySummary(value: unknown): InventorySummary {
  const raw = (typeof value === "object" && value !== null ? value : {}) as Record<
    string,
    unknown
  >;

  const count = (input: unknown): number => {
    const parsed = number(input);
    return parsed !== null && Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  };

  const byAvailability: Record<string, number> = {};
  const breakdown = raw.by_availability;
  if (typeof breakdown === "object" && breakdown !== null && !Array.isArray(breakdown)) {
    for (const [key, item] of Object.entries(breakdown as Record<string, unknown>)) {
      byAvailability[key] = count(item);
    }
  }

  return {
    totalPublished: count(raw.total_published),
    archived: count(raw.archived),
    byAvailability,
    imageCount: count(raw.image_count),
  };
}
