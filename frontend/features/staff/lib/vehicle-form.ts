/**
 * Turning the vehicle form's `FormData` into a request body.
 *
 * ---------------------------------------------------------------------------
 * What this is for, precisely
 * ---------------------------------------------------------------------------
 * The backend validates everything twice over: Pydantic on the way in, and CHECK
 * constraints on the way to the database. This file does not add a third
 * security control and is not one. It exists so that a staff member finds out
 * about a missing model year *before* the round trip, and finds out which field
 * is wrong rather than being handed a `422` with a field path in it.
 *
 * Every rule here therefore mirrors `backend/app/schemas/vehicle_write.py` rather
 * than inventing its own. The duplication is unavoidable in principle - a browser
 * cannot import a Python module - and it is kept honest by the fact that the two
 * are tested against the same numbers and by the comment on each rule naming the
 * schema it comes from. If a rule changes on one side, the other is a bug, and
 * the backend's own test suite is what proves the server is the stricter of the
 * two: anything this file accepts and the backend rejects is a wasted round trip,
 * never a wrong write.
 *
 * ---------------------------------------------------------------------------
 * Why the form is *not* validated at all
 * ---------------------------------------------------------------------------
 * `onSubmit` on a `<form>` is trivially bypassed, and anything a server action
 * trusts because the browser checked it first is not protected at all. So the
 * shape returned here is: parse, check, and if anything is wrong return the
 * submitted values alongside the errors so the form can be re-rendered filled in.
 * Losing a staff member's carefully typed description because one field was
 * blank is its own kind of data loss, and it is the kind this project has
 * repeatedly refused to cause.
 */

// Relative, and with the real extension, unlike every other import in this
// project. The unit tests run on `node --test`, which resolves neither the `@/`
// alias nor an extensionless specifier for stripped TypeScript, so a module that
// is under test and has a *value* import has to name its dependency the way Node
// can find it. Every other import in this file is `import type`, which is erased
// before the test runner sees the module, so this is the only line that has to
// accommodate it.
import { normaliseSlug } from "../../../lib/slug.ts";

import type { VehicleWriteBody } from "@/lib/api/admin-vehicles";
import type { VehicleAvailability } from "@/types/staff";

/** Every text field, kept as the string the staff member typed. */
export interface VehicleFormValues {
  slug: string;
  make: string;
  model: string;
  variant: string;
  year: string;
  body_type: string;
  transmission: string;
  fuel: string;
  colour: string;
  mileage_km: string;
  vin: string;
  price: string;
  status: string;
  location: string;
  /** Ordered, so the form can render and round-trip the rows the staff member saw. */
  featureRows: Array<{ name: string; value: string }>;
}

/** Per-field messages, keyed by the field name used in the form. */
export type VehicleFormErrors = Partial<Record<keyof VehicleFormValues, string>> &
  Record<string, string>;

export type VehicleFormResult =
  // `values` is on *both* branches, deliberately. A form that passes validation and
  // then fails the API call - a duplicate slug, a network blurb, a 500 - must still
  // come back filled in, and by that point the only copy of what the staff member
  // typed is inside the parser's return value. Carrying it on the success branch
  // too is what makes a write failure echoable rather than a blank form.
  | { ok: true; body: VehicleWriteBody; values: VehicleFormValues }
  | { ok: false; errors: VehicleFormErrors; values: VehicleFormValues };

/* -------------------------------------------------------------------------
 * Limits, transcribed from the backend schema
 * ---------------------------------------------------------------------- */

/** `RequiredText` / `Slug` in `vehicle_write.py`. */
const MAX_SLUG = 200;
const MAX_TEXT = 120;

/** `_OPTIONAL_LIMITS` in `vehicle_write.py`. */
const MAX_BODY_TYPE = 60;
const MAX_TRANSMISSION = 60;
const MAX_FUEL = 60;
const MAX_COLOUR = 60;
const MAX_LOCATION = 160;

/** `_clean_features`: name 60, value 200, and `features` at most 60 rows. */
const MAX_FEATURE_NAME = 60;
const MAX_FEATURE_VALUE = 200;
const MAX_FEATURE_ROWS = 60;

/**
 * `Money = Decimal(gt=0, max_digits=12, decimal_places=2)`.
 *
 * `max_digits` counts the digits either side of the point, so the two numbers below
 * are not independent - and the pattern is built from them rather than written out,
 * so the three cannot drift apart. A hand-written `\d{1,10}` here would be a
 * second, silent copy of a constraint the backend owns, and the failure would be a
 * price rejected at the API with a message about "the request".
 */
const MAX_PRICE_DIGITS = 12;
const MAX_PRICE_DECIMALS = 2;
const PRICE_PATTERN = new RegExp(
  `^\\d{1,${MAX_PRICE_DIGITS - MAX_PRICE_DECIMALS}}(\\.\\d{1,${MAX_PRICE_DECIMALS}})?$`,
);

/** `EARLIEST_MODEL_YEAR` and `latest_plausible_model_year()`. */
const EARLIEST_MODEL_YEAR = 1900;

const AVAILABILITY: readonly VehicleAvailability[] = ["available", "reserved", "sold"];

/** `VIN_PATTERN` and the schema's 17-character constraint. */
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/i;

/** The only currency, and the only one the form offers. */
const CURRENCY = "USD";

function latestPlausibleModelYear(): number {
  return new Date().getFullYear() + 1;
}

/* -------------------------------------------------------------------------
 * Field readers
 * ---------------------------------------------------------------------- */

/** A trimmed string from the form, or `""`. */
function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Every feature row, paired by index and returned in order.
 *
 * The two lists are read independently and zipped, rather than requiring matched
 * `name`/`value` indices in the field names. Two independently-addable rows in a
 * React list need stable keys, and index-keyed pairs are the only shape that
 * survives a row being removed from the middle without every subsequent row
 * changing identity - which would put one row's name into another's value field.
 */
function featureRows(form: FormData): Array<{ name: string; value: string }> {
  const names = form.getAll("feature_name");
  const values = form.getAll("feature_value");

  const rows: Array<{ name: string; value: string }> = [];
  const count = Math.max(names.length, values.length);
  for (let index = 0; index < count; index += 1) {
    const rawName = names[index];
    const rawValue = values[index];
    rows.push({
      name: typeof rawName === "string" ? rawName.trim() : "",
      value: typeof rawValue === "string" ? rawValue.trim() : "",
    });
  }
  return rows;
}

/* -------------------------------------------------------------------------
 * Field validators
 *
 * Each returns a normalised value, or a message. `null` and `undefined` are
 * deliberately distinct throughout: `null` is "not recorded", and the backend
 * treats an omitted optional field and a blank one identically, so the form can
 * normalise a cleared input to `null` without thinking about it.
 * ---------------------------------------------------------------------- */

/** A whole number, or a message. Rejects decimals and non-numeric text. */
function wholeNumber(value: string): { value: number } | { error: string } {
  if (value === "") return { error: "This field is required." };
  if (!/^\d+$/.test(value)) return { error: "Enter a whole number." };
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) return { error: "That number is too large." };
  return { value: parsed };
}

/* -------------------------------------------------------------------------
 * Public API
 * ---------------------------------------------------------------------- */

/** Blank form, for "add a vehicle". */
export function emptyVehicleFormValues(): VehicleFormValues {
  return {
    slug: "",
    make: "",
    model: "",
    variant: "",
    // The current model year is a reasonable default for a car being added today,
    // and it is the one field a staff member is most likely to have to look up.
    // It is still an editable value they can change, not a derived guess.
    year: String(new Date().getFullYear()),
    body_type: "",
    transmission: "",
    fuel: "",
    colour: "",
    mileage_km: "",
    vin: "",
    price: "",
    status: "available",
    location: "",
    featureRows: [],
  };
}

/** Form pre-filled from an existing vehicle, for the editor. */
export function vehicleFormValues(vehicle: {
  slug: string;
  make: string;
  model: string;
  variant: string | null;
  year: number;
  bodyType: string | null;
  transmission: string | null;
  fuel: string | null;
  colour: string | null;
  mileageKm: number | null;
  vin: string | null;
  price: number | null;
  status: string;
  location: string | null;
  features: Array<{ name: string; value: string }>;
}): VehicleFormValues {
  return {
    slug: vehicle.slug,
    make: vehicle.make,
    model: vehicle.model,
    variant: vehicle.variant ?? "",
    year: String(vehicle.year),
    body_type: vehicle.bodyType ?? "",
    transmission: vehicle.transmission ?? "",
    fuel: vehicle.fuel ?? "",
    colour: vehicle.colour ?? "",
    // `String(number)` rather than a locale format: the value has to round-trip
    // through `wholeNumber` and a thousands separator would be rejected by it.
    mileage_km: vehicle.mileageKm === null ? "" : String(vehicle.mileageKm),
    vin: vehicle.vin ?? "",
    price: vehicle.price === null ? "" : String(vehicle.price),
    status: vehicle.status,
    location: vehicle.location ?? "",
    featureRows: vehicle.features.map((row) => ({ ...row })),
  };
}

/**
 * Suggests a slug from a make, model and variant.
 *
 * Offered to the form as a button, never applied automatically. A slug is a
 * public URL: if it changed every time the make was corrected, every link to that
 * vehicle would break, so it is a value somebody decides once. Suggesting it is
 * help; applying it would be a decision made on the staff member's behalf.
 */
export function suggestSlug(parts: {
  make: string;
  model: string;
  variant?: string | null;
}): string {
  return normaliseSlug([parts.make, parts.model, parts.variant].filter(Boolean).join(" ")) ?? "";
}

/**
 * Parses and checks the submitted form.
 *
 * Returns the body to send, or the errors plus everything the staff member
 * typed. Never throws and never partially succeeds: a form that saved the
 * description but not the mileage would be worse than one that refused and said
 * why.
 */
export function parseVehicleForm(form: FormData): VehicleFormResult {
  const values: VehicleFormValues = {
    slug: field(form, "slug"),
    make: field(form, "make"),
    model: field(form, "model"),
    variant: field(form, "variant"),
    year: field(form, "year"),
    body_type: field(form, "body_type"),
    transmission: field(form, "transmission"),
    fuel: field(form, "fuel"),
    colour: field(form, "colour"),
    mileage_km: field(form, "mileage_km"),
    vin: field(form, "vin"),
    price: field(form, "price"),
    status: field(form, "status"),
    location: field(form, "location"),
    featureRows: featureRows(form),
  };

  const errors: VehicleFormErrors = {};

  // Slug: normalised with the public site's own function, so a slug that works
  // here works as a URL there. `null` means the typed value had no slug-safe
  // characters in it at all - "!!!" normalises to nothing - which is a different
  // failure from an empty field and gets its own message.
  const slugValue = normaliseSlug(values.slug);
  if (slugValue === null) {
    errors.slug =
      values.slug === ""
        ? "A URL slug is required."
        : "This slug has no characters that can appear in a web address.";
  } else if (slugValue.length > MAX_SLUG) {
    errors.slug = `Must be ${MAX_SLUG} characters or fewer.`;
  }

  for (const [key, value, limit] of [
    ["make", values.make, MAX_TEXT],
    ["model", values.model, MAX_TEXT],
    ["variant", values.variant, MAX_TEXT],
  ] as const) {
    if (value === "") {
      if (key !== "variant") errors[key] = "This field is required.";
    } else if (value.length > limit) {
      errors[key] = `Must be ${limit} characters or fewer.`;
    }
  }

  const year = wholeNumber(values.year);
  if ("error" in year) {
    errors.year = year.error;
  } else if (year.value < EARLIEST_MODEL_YEAR || year.value > latestPlausibleModelYear()) {
    errors.year = `Must be between ${EARLIEST_MODEL_YEAR} and ${latestPlausibleModelYear()}.`;
  }

  for (const [key, value, limit] of [
    ["body_type", values.body_type, MAX_BODY_TYPE],
    ["transmission", values.transmission, MAX_TRANSMISSION],
    ["fuel", values.fuel, MAX_FUEL],
    ["colour", values.colour, MAX_COLOUR],
    ["location", values.location, MAX_LOCATION],
  ] as const) {
    if (value === "") continue;
    if (value.length > limit) errors[key] = `Must be ${limit} characters or fewer.`;
  }

  let mileage: number | null = null;
  if (values.mileage_km !== "") {
    const parsed = wholeNumber(values.mileage_km);
    if ("error" in parsed) {
      errors.mileage_km = parsed.error;
    } else {
      mileage = parsed.value;
    }
  }

  let vin: string | null = null;
  if (values.vin !== "") {
    if (!VIN_PATTERN.test(values.vin)) {
      errors.vin = "A VIN is 17 characters, and cannot contain I, O or Q.";
    } else {
      // Upper-cased because that is how the backend stores it, and a lowercase
      // value on this screen and an uppercase one in the database is a confusing
      // difference to find later.
      vin = values.vin.toUpperCase();
    }
  }

  let price: number | null = null;
  if (values.price !== "") {
    if (!PRICE_PATTERN.test(values.price)) {
      errors.price = "Enter an amount in dollars, with up to two decimal places.";
    } else {
      const parsed = Number(values.price);
      if (!(parsed > 0)) {
        // `0` is rejected rather than treated as "not priced". The backend
        // refuses it too, and a form that quietly converted a typed 0 into
        // "price on request" would be hiding a mistake.
        errors.price = "Enter an amount above zero, or leave this blank for price on request.";
      } else {
        price = parsed;
      }
    }
  }

  let status: string = AVAILABILITY.includes(values.status as VehicleAvailability)
    ? values.status
    : "";
  if (status === "") {
    errors.status = "Choose one of the available states.";
    status = "available";
  }

  // Feature rows: a half-filled row is an error rather than something to skip.
  // Silently dropping the row the staff member typed looks like a save that lost
  // data, which is the outcome `_clean_features` rejects for the same reason.
  const featurePairs: Record<string, string> = {};
  if (values.featureRows.length > MAX_FEATURE_ROWS) {
    errors.features = `A vehicle can have at most ${MAX_FEATURE_ROWS} features.`;
  } else {
    const names = new Set<string>();
    values.featureRows.forEach((row, index) => {
      if (row.name === "" && row.value === "") return;

      if (row.name === "") {
        errors[`feature_${index}`] = "This feature needs a name.";
        return;
      }
      if (row.name.length > MAX_FEATURE_NAME) {
        errors[`feature_${index}`] = `A feature name must be ${MAX_FEATURE_NAME} characters or fewer.`;
        return;
      }
      if (row.value === "") {
        errors[`feature_${index}`] = `Feature "${row.name}" needs a value.`;
        return;
      }
      if (row.value.length > MAX_FEATURE_VALUE) {
        errors[`feature_${index}`] =
          `Feature "${row.name}" must be ${MAX_FEATURE_VALUE} characters or fewer.`;
        return;
      }
      // A JSON object cannot hold two rows with the same name, so accepting them
      // would silently drop one on the way to the database.
      if (names.has(row.name)) {
        errors[`feature_${index}`] = `There is already a feature called "${row.name}".`;
        return;
      }
      names.add(row.name);
      featurePairs[row.name] = row.value;
    });
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, values };
  }

  return {
    ok: true,
    // Echoed on the success branch so a failed API write can hand the form back
    // what was typed. See the note on `VehicleFormResult`.
    values,
    body: {
      slug: slugValue as string,
      make: values.make,
      model: values.model,
      variant: values.variant === "" ? null : values.variant,
      year: (year as { value: number }).value,
      body_type: values.body_type === "" ? null : values.body_type,
      transmission: values.transmission === "" ? null : values.transmission,
      fuel: values.fuel === "" ? null : values.fuel,
      colour: values.colour === "" ? null : values.colour,
      mileage_km: mileage,
      vin,
      price,
      // Sent as a constant rather than read from the form. The backend accepts
      // the field only to refuse every value except USD, and the form does not
      // render a currency control at all - a dropdown offering one option is a
      // lie about choice.
      currency: CURRENCY,
      status,
      location: values.location === "" ? null : values.location,
      features: Object.keys(featurePairs).length > 0 ? featurePairs : null,
    },
  };
}

/** The states the form offers, in the order a staff member reads them. */
export const AVAILABILITY_OPTIONS: ReadonlyArray<{ value: VehicleAvailability; label: string }> = [
  { value: "available", label: "Available" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
];
