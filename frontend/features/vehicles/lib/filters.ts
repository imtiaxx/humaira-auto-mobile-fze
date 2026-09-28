/**
 * Turning the inventory URL into a filter the API will accept.
 *
 * ---------------------------------------------------------------------------
 * What this is for, precisely
 * ---------------------------------------------------------------------------
 * The filter bar on `/inventory` is a plain `<form method="get">`. It has no
 * client-side router, no fetch, and no JavaScript requirement: submitting it
 * produces an ordinary address-bar URL, and this module is what reads that URL
 * back into a `VehicleFilters`.
 *
 * That means the query string is **user input**, in the same way a staff form's
 * `FormData` is. A visitor can hand-type `/inventory?min_price=abc`, or
 * `/inventory?max_year=9000`, or paste a link someone sent them. Without this
 * module those values would reach `GET /vehicles`, come back `422`, and
 * `listVehicles()` would - correctly, and by design - degrade to an empty list.
 * A customer who mistypes a price would be told the dealership has no vehicles.
 *
 * So the rules here mirror `backend/app/schemas/vehicle.py`'s
 * `VehicleFilterQuery`, and each one names the schema rule it comes from. The
 * relationship to the backend is the one `features/staff/lib/vehicle-form.ts`
 * documents, and it is the same relationship: **anything this file accepts and
 * the backend rejects is a wasted round trip; anything this file rejects and the
 * backend accepts is a stricter UX, never a wrong answer.** The backend is always
 * the authority, and its own test suite is what proves it.
 *
 * ---------------------------------------------------------------------------
 * What a rejected value does
 * ---------------------------------------------------------------------------
 * It is dropped from `filters` and reported in `errors`, keyed by field. So a
 * mistyped year is shown as a message on the year control, the year is *not*
 * sent, and the rest of the filter still applies. The alternative - refusing to
 * render the page at all - would mean one bad parameter hides thirteen real
 * cars from a visitor, and the error boundary is the wrong tool for "you typed
 * this slightly wrong".
 *
 * The submitted text is never lost. A GET form round-trips through the address
 * bar, so the form re-renders from the same URL the visitor submitted and their
 * other four choices are still in the fields. That is the reason this page uses a
 * GET form rather than a client-side state object, and it is worth stating: the
 * "don't lose what the user typed" property that `vehicle-form.ts` has to
 * implement by returning `values` on both branches is structural here.
 */

/** Every filter key, in the order the control set presents them. */
export const FILTER_KEYS = [
  "query",
  "make",
  "body_type",
  "fuel",
  "transmission",
  "min_price",
  "max_price",
  "min_year",
  "max_year",
  "status",
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

/** The three availability states, from `VehicleStatus` and the backend's validator. */
export const FILTER_STATUSES = ["available", "reserved", "sold"] as const;

/* -------------------------------------------------------------------------
 * Limits, transcribed from `backend/app/schemas/vehicle.py`
 * ---------------------------------------------------------------------- */

/** `MAX_QUERY_LENGTH`. */
const MAX_QUERY_LENGTH = 120;

/** `MAX_FACET_LENGTH`. */
const MAX_FACET_LENGTH = 120;

/**
 * `MAX_FILTER_PRICE = Decimal(10**9)`, with `gt=0`.
 *
 * Ten whole digits, because `10**9` is one billion and *is* ten digits long -
 * a nine-digit budget would refuse the one figure the backend explicitly allows,
 * which is the kind of off-by-one that only shows up on a legitimate value.
 * Two decimals, from the same `Decimal` the backend parses into.
 *
 * The pattern is built from the two budgets rather than written out, so they
 * cannot drift apart, exactly as in `vehicle-form.ts`.
 */
const MAX_PRICE = 1_000_000_000;
const MAX_PRICE_WHOLE_DIGITS = 10;
const MAX_PRICE_DECIMALS = 2;
const PRICE_PATTERN = new RegExp(
  `^\\d{1,${MAX_PRICE_WHOLE_DIGITS}}(\\.\\d{1,${MAX_PRICE_DECIMALS}})?$`,
);

/**
 * A signed number, checked before the budget pattern.
 *
 * Separate so that `-1` is reported as "above zero" rather than as malformed
 * text. Both are refusals, but the message is the only thing telling the visitor
 * which half of their input was wrong, and "enter an amount in US dollars" in
 * reply to `-1` reads as though the minus sign were a typo.
 */
const SIGNED_NUMBER_PATTERN = /^[+-]?\d+(?:\.\d+)?$/;

/** `EARLIEST_MODEL_YEAR`, in `app/db/models/vehicle.py`. */
const EARLIEST_MODEL_YEAR = 1900;

/**
 * `latest_plausible_model_year()` in the backend schema: the current year plus
 * one, the same guard the vehicle schema applies to `year`.
 *
 * Computed here rather than imported, because a browser cannot import a Python
 * module, and `vehicle-form.ts` already accepts that duplication for the same
 * reason. Being one day out of step with the server would only ever make this
 * side *stricter* for a few hours a year, at new year.
 */
function latestPlausibleModelYear(): number {
  return new Date().getFullYear() + 1;
}

/** Per-field messages, keyed by the filter key used in the URL and the form. */
export type VehicleFilterErrors = Partial<Record<FilterKey, string>>;

export interface ParsedVehicleFilters {
  /** Only the values that passed. Absent keys mean "no filter". */
  filters: VehicleFiltersShape;
  errors: VehicleFilterErrors;
  /** True when at least one filter survived parsing. */
  active: boolean;
  /**
   * True when a value was present but rejected. Distinguishes "no filter" from
   * "your filter was wrong", which are different things to tell a visitor.
   */
  rejected: boolean;
}

/**
 * The parsed filter, typed as the domain `VehicleFilters`.
 *
 * Declared structurally rather than imported as `VehicleFilters` because
 * `types/vehicle.ts` is a type-only module and this one has a value import
 * (`FILTER_KEYS`), which `node --test` cannot resolve through the `@/` alias.
 * The shape is the domain type, field for field, and the test file asserts that
 * the two agree on the keys so a future edit to either is caught.
 */
export interface VehicleFiltersShape {
  query?: string;
  make?: string;
  bodyType?: string;
  fuel?: string;
  transmission?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  status?: FilterStatus;
}

export type FilterStatus = (typeof FILTER_STATUSES)[number];

/**
 * The raw query string, as `searchParams` hands it over.
 *
 * A repeated key (`?make=a&make=b`) is not a thing a form produces and not a
 * thing the API documents. The **last** value wins, which is what every other
 * layer between here and the database does with a repeated parameter, so this
 * cannot be the one place a different one is invented.
 */
function readParam(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  if (params instanceof URLSearchParams) return params.get(key);

  const raw = params[key];
  if (raw === undefined) return null;
  if (Array.isArray(raw)) return raw.length > 0 ? raw[raw.length - 1] : null;
  return raw;
}

/**
 * A trimmed facet value, or a message.
 *
 * Blank is absence, not a search for the empty string: `_blank_facet_is_absent`
 * in the backend schema makes the same call, and `?make=` meaning "every make" is
 * the only reading a visitor could have.
 */
function facet(
  value: string | null,
  max: number,
  errors: VehicleFilterErrors,
  key: FilterKey,
): string | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (trimmed.length > max) {
    errors[key] = `Use ${max} characters or fewer.`;
    return undefined;
  }
  return trimmed;
}

/** A positive price in USD, or a message. */
function price(
  value: string | null,
  errors: VehicleFilterErrors,
  key: FilterKey,
): number | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;

  /*
    The sign is checked before the budget pattern on purpose. `PRICE_PATTERN`
    admits digits only, so without this `-1` would fail it and be reported as
    malformed text - "enter an amount in US dollars" - in reply to a number whose
    only problem is its sign. The visitor edits the number, not the punctuation,
    so the message has to point at the sign.
  */
  if (!SIGNED_NUMBER_PATTERN.test(trimmed)) {
    errors[key] = "Enter an amount in US dollars, such as 25000 or 25000.50.";
    return undefined;
  }

  const parsed = Number(trimmed);
  if (parsed <= 0) {
    errors[key] = "Enter an amount above zero.";
    return undefined;
  }

  // Ten whole digits is the *shape* of the ceiling; `MAX_FILTER_PRICE` is the
  // value of it, and `9999999999` has ten digits without being under a billion.
  // Both have to hold.
  if (!PRICE_PATTERN.test(trimmed) || parsed > MAX_PRICE) {
    errors[key] = "Enter an amount in US dollars, such as 25000 or 25000.50.";
    return undefined;
  }

  return parsed;
}

/** A whole model year within the plausible range, or a message. */
function year(
  value: string | null,
  errors: VehicleFilterErrors,
  key: FilterKey,
): number | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;

  if (!/^\d+$/.test(trimmed)) {
    errors[key] = "Enter four digits, such as 2022.";
    return undefined;
  }

  const parsed = Number(trimmed);
  const latest = latestPlausibleModelYear();
  if (parsed < EARLIEST_MODEL_YEAR || parsed > latest) {
    errors[key] = `Enter a year from ${EARLIEST_MODEL_YEAR} to ${latest}.`;
    return undefined;
  }

  return parsed;
}

/**
 * An availability state, or a message.
 *
 * An unrecognised value is a **message, not an empty result**. The backend's
 * `_reject_unknown_status` agrees, and the reason is the one `docs/api.md` gives:
 * answering `?status=avaliable` with the whole inventory would present a broken
 * filter link as a working one. Silently ignoring it here would be the same
 * failure one layer earlier.
 */
function status(
  value: string | null,
  errors: VehicleFilterErrors,
): FilterStatus | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "") return undefined;

  const match = FILTER_STATUSES.find((candidate) => candidate === trimmed);
  if (!match) {
    errors.status = "Choose available, reserved or sold.";
    return undefined;
  }

  return match;
}

/**
 * Cross-field range check, mirroring `_check_filter_ranges`.
 *
 * Reported on the **upper** bound rather than both, because the upper bound is
 * the one a visitor edits to fix it: "Maximum price cannot be below the minimum"
 * names the field to change.
 *
 * Returns whether the pair is usable. An inverted pair is dropped whole rather
 * than reported alongside the values that caused it: leaving both in `filters`
 * would send `min_price=75000&max_price=25000` to the API, which answers `422`,
 * which `listVehicles` degrades to an empty grid - the page would show "no
 * vehicles match" and, beside it, a complaint about a value it had just sent
 * anyway. An error that is also transmitted is not an error, it is a `422` with
 * better manners.
 */
function checkRange(
  min: number | undefined,
  max: number | undefined,
  errors: VehicleFilterErrors,
  maxKey: FilterKey,
  label: string,
): boolean {
  if (min === undefined || max === undefined) return true;

  if (min <= max) return true;

  errors[maxKey] = `Maximum ${label} cannot be below the minimum.`;
  return false;
}

/**
 * Reads the inventory query string into a filter the API will accept.
 *
 * Pure: no `fetch`, no clock beyond `new Date()` for the year bound, and no
 * globals. That is what makes the rules above testable at all.
 */
export function parseVehicleFilters(
  params: URLSearchParams | Record<string, string | string[] | undefined> = {},
): ParsedVehicleFilters {
  const errors: VehicleFilterErrors = {};

  const filters: VehicleFiltersShape = {};

  const query = facet(readParam(params, "query"), MAX_QUERY_LENGTH, errors, "query");
  if (query !== undefined) filters.query = query;

  const make = facet(readParam(params, "make"), MAX_FACET_LENGTH, errors, "make");
  if (make !== undefined) filters.make = make;

  const bodyType = facet(readParam(params, "body_type"), MAX_FACET_LENGTH, errors, "body_type");
  if (bodyType !== undefined) filters.bodyType = bodyType;

  const fuel = facet(readParam(params, "fuel"), MAX_FACET_LENGTH, errors, "fuel");
  if (fuel !== undefined) filters.fuel = fuel;

  const transmission = facet(
    readParam(params, "transmission"),
    MAX_FACET_LENGTH,
    errors,
    "transmission",
  );
  if (transmission !== undefined) filters.transmission = transmission;

  const minPrice = price(readParam(params, "min_price"), errors, "min_price");
  if (minPrice !== undefined) filters.minPrice = minPrice;

  const maxPrice = price(readParam(params, "max_price"), errors, "max_price");
  if (maxPrice !== undefined) filters.maxPrice = maxPrice;

  const minYear = year(readParam(params, "min_year"), errors, "min_year");
  if (minYear !== undefined) filters.minYear = minYear;

  const maxYear = year(readParam(params, "max_year"), errors, "max_year");
  if (maxYear !== undefined) filters.maxYear = maxYear;

  const availability = status(readParam(params, "status"), errors);
  if (availability !== undefined) filters.status = availability;

  // Only worth checking when both ends survived: a pair containing a rejected
  // value has already been reported, and a second message on the other field
  // would be noise about a value the visitor never typed.
  if (
    errors.min_price === undefined &&
    errors.max_price === undefined &&
    !checkRange(minPrice, maxPrice, errors, "max_price", "price")
  ) {
    delete filters.minPrice;
    delete filters.maxPrice;
  }
  if (
    errors.min_year === undefined &&
    errors.max_year === undefined &&
    !checkRange(minYear, maxYear, errors, "max_year", "year")
  ) {
    delete filters.minYear;
    delete filters.maxYear;
  }

  const active = Object.keys(filters).length > 0;

  return { filters, errors, active, rejected: Object.keys(errors).length > 0 };
}

/**
 * True when any filter is set.
 *
 * Exists so a caller does not have to remember that `{}` is falsy-but-valid and
 * that `active` is the honest answer. Used to decide between "no stock" and
 * "no matches", which are different facts about a real business.
 */
export function isFiltered(filters: VehicleFiltersShape): boolean {
  return FILTER_KEYS.some((key) => {
    const value = filters[camelKey(key)];
    return value !== undefined && value !== "";
  });
}

function camelKey(key: FilterKey): keyof VehicleFiltersShape {
  switch (key) {
    case "query":
      return "query";
    case "make":
      return "make";
    case "body_type":
      return "bodyType";
    case "fuel":
      return "fuel";
    case "transmission":
      return "transmission";
    case "min_price":
      return "minPrice";
    case "max_price":
      return "maxPrice";
    case "min_year":
      return "minYear";
    case "max_year":
      return "maxYear";
    case "status":
      return "status";
  }
}

/**
 * Human-readable summary of the active filters, for the results line.
 *
 * Built from the *values*, not the keys, because this string is shown to a
 * visitor: "Diesel, under $40,000" is a description of a search and "fuel,
 * max_price" is a list of column names. Filters with no value are skipped, so a
 * partially filled form never renders a dangling "and".
 */
export function describeFilters(filters: VehicleFiltersShape): string {
  const parts: string[] = [];

  if (filters.query) parts.push(`"${filters.query}"`);
  if (filters.make) parts.push(filters.make);
  if (filters.bodyType) parts.push(filters.bodyType);
  if (filters.fuel) parts.push(filters.fuel);
  if (filters.transmission) parts.push(filters.transmission);
  if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
    parts.push(`$${filters.minPrice.toLocaleString("en-US")} to $${filters.maxPrice.toLocaleString("en-US")}`);
  } else if (filters.minPrice !== undefined) {
    parts.push(`from $${filters.minPrice.toLocaleString("en-US")}`);
  } else if (filters.maxPrice !== undefined) {
    parts.push(`up to $${filters.maxPrice.toLocaleString("en-US")}`);
  }
  if (filters.minYear !== undefined && filters.maxYear !== undefined) {
    parts.push(`${filters.minYear} to ${filters.maxYear}`);
  } else if (filters.minYear !== undefined) {
    parts.push(`${filters.minYear} or newer`);
  } else if (filters.maxYear !== undefined) {
    parts.push(`${filters.maxYear} or older`);
  }
  if (filters.status) parts.push(filters.status);

  return parts.join(", ");
}
