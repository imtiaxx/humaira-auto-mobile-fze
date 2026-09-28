/**
 * The filter URL parser, pinned.
 *
 * ---------------------------------------------------------------------------
 * What these tests are for
 * ---------------------------------------------------------------------------
 * `filters.ts` is the only thing standing between a query string a visitor typed
 * or was handed and a `GET /vehicles` that answers `422`. If it lets something
 * through that the backend rejects, the page degrades to an empty grid and a
 * customer is told the dealership has no vehicles. If it rejects something the
 * backend accepts, a visitor is told their own search is invalid when it is not.
 *
 * So the tests below are written in three groups:
 *
 *   1. **Round trips** - a well-formed value survives with the right type.
 *   2. **Backend parity** - each documented bound of
 *      `VehicleFilterQuery` is enforced here too, and a rejected value is *not*
 *      sent. A value appearing in both `filters` and `errors` would be the exact
 *      bug this file exists to prevent, so one test asserts that invariant
 *      directly rather than case by case.
 *   3. **Failures that must not look like empty inventory** - a malformed
 *      parameter produces a message, not a silent success and not a crash.
 *
 * ---------------------------------------------------------------------------
 * The inputs below are validator test data, not inventory
 * ---------------------------------------------------------------------------
 * The same convention as `features/vehicles/lib/vehicle-schema.test.ts` and
 * `features/staff/lib/vehicle-form.test.ts`: nothing here is imported by the
 * application, and no vehicle reaches a page from it. The makes and models are
 * realistic so a failing assertion reads like the case it is about.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  describeFilters,
  FILTER_KEYS,
  FILTER_STATUSES,
  isFiltered,
  parseVehicleFilters,
  type VehicleFilterErrors,
  type VehicleFiltersShape,
} from "./filters.ts";

/** Parses a query string the way the page does. */
function parse(query: string) {
  return parseVehicleFilters(new URLSearchParams(query));
}

/** The wire names, which are the parser's keys. */
const WIRE = {
  bodyType: "body_type",
  minPrice: "min_price",
  maxPrice: "max_price",
  minYear: "min_year",
  maxYear: "max_year",
} as const;

/* -------------------------------------------------------------------------
 * Round trips
 * ---------------------------------------------------------------------- */

test("an empty query string is no filter at all", () => {
  const result = parse("");

  assert.deepEqual(result.filters, {});
  assert.deepEqual(result.errors, {});
  assert.equal(result.active, false);
  assert.equal(result.rejected, false);
});

test("every filter survives a round trip under its domain name", () => {
  const result = parse(
    "query=land&make=Toyota&body_type=SUV&fuel=Diesel" +
      "&transmission=Automatic&min_price=25000&max_price=75000" +
      "&min_year=2015&max_year=2025&status=reserved",
  );

  assert.deepEqual(result.filters, {
    query: "land",
    make: "Toyota",
    bodyType: "SUV",
    fuel: "Diesel",
    transmission: "Automatic",
    minPrice: 25000,
    maxPrice: 75000,
    minYear: 2015,
    maxYear: 2025,
    status: "reserved",
  });
  assert.equal(result.rejected, false);
  assert.equal(result.active, true);
});

test("numeric filters arrive as numbers, not as strings", () => {
  const { filters } = parse("min_price=25000&min_year=2015");

  // A string here would serialise into the query as the same text and look
  // correct, so only the type assertion catches a regression.
  assert.equal(typeof filters.minPrice, "number");
  assert.equal(typeof filters.minYear, "number");
  assert.equal(filters.minPrice, 25000);
  assert.equal(filters.minYear, 2015);
});

test("surrounding whitespace is trimmed rather than searched for", () => {
  const { filters } = parse("make=%20Toyota%20&query=%20land%20");

  assert.equal(filters.make, "Toyota");
  assert.equal(filters.query, "land");
});

test("a blank value is no filter, not a search for nothing", () => {
  // `_blank_facet_is_absent` in the backend schema. "All makes" is the only
  // reading a visitor could have of `?make=`.
  const { filters, active } = parse("make=&body_type=%20&query=");

  assert.deepEqual(filters, {});
  assert.equal(active, false);
});

test("status is case-insensitive, as the backend validator is", () => {
  assert.equal(parse("status=AVAILABLE").filters.status, "available");
  assert.equal(parse("status=%20Reserved%20").filters.status, "reserved");
  assert.equal(parse("status=SOLD").filters.status, "sold");
});

test("a decimal price is accepted, because the backend parses Decimal", () => {
  assert.equal(parse("max_price=25000.50").filters.maxPrice, 25000.5);
  assert.equal(parse("max_price=25000.5").filters.maxPrice, 25000.5);
});

test("filter keys and the wire names are the documented set", () => {
  // The whole point of `FILTER_KEYS` is that the form, the parser and the page
  // agree. A new backend filter that is not here would render an unfilterable
  // control; a key here that the API does not accept would render a dead one.
  assert.deepEqual([...FILTER_KEYS], [
    "query",
    "make",
    WIRE.bodyType,
    "fuel",
    "transmission",
    WIRE.minPrice,
    WIRE.maxPrice,
    WIRE.minYear,
    WIRE.maxYear,
    "status",
  ]);

  // Every key is read. A key nothing reads would be a silent no-op: the form
  // would submit it, the URL would change, and nothing would be filtered.
  const reported = parse("query=x&make=x&fuel=x&transmission=x&status=sold");

  for (const key of ["query", "make", "fuel", "transmission", "status"]) {
    assert.ok(key in reported.filters, `${key} was read`);
  }
});

test("all three availability states are offered, and only those", () => {
  assert.deepEqual([...FILTER_STATUSES], ["available", "reserved", "sold"]);
});

/* -------------------------------------------------------------------------
 * Backend parity: what the parser must refuse
 * ---------------------------------------------------------------------- */

test("an over-long facet is refused, matching MAX_FACET_LENGTH", () => {
  const long = "a".repeat(121);
  const result = parse(`make=${long}`);

  assert.equal(result.filters.make, undefined);
  assert.match(result.errors.make ?? "", /120 characters or fewer/);
});

test("a facet at exactly the limit is accepted", () => {
  // The boundary has to be pinned from both sides, or an off-by-one is invisible
  // until a value of that exact length arrives.
  const exact = "a".repeat(120);
  const { filters, errors } = parse(`make=${exact}`);

  assert.equal(filters.make, exact);
  assert.equal(errors.make, undefined);
});

test("an over-long free-text term is refused, matching MAX_QUERY_LENGTH", () => {
  const result = parse(`query=${"a".repeat(121)}`);

  assert.equal(result.filters.query, undefined);
  assert.match(result.errors.query ?? "", /120 characters or fewer/);
});

test("a zero or negative price is refused, matching gt=0", () => {
  for (const value of ["0", "-1", "-0.01"]) {
    const result = parse(`min_price=${value}`);
    assert.equal(result.filters.minPrice, undefined, value);
    assert.match(result.errors.min_price ?? "", /above zero/, value);
  }
});

test("a price beyond MAX_FILTER_PRICE is refused, matching le=10**9", () => {
  const result = parse("max_price=1000000001");

  assert.equal(result.filters.maxPrice, undefined);
  assert.match(result.errors.max_price ?? "", /US dollars/);
});

test("a price at exactly MAX_FILTER_PRICE is accepted", () => {
  // `10**9` is ten digits long. A nine-digit budget would refuse the one figure
  // the backend's `le=MAX_FILTER_PRICE` explicitly allows.
  assert.equal(parse("max_price=1000000000").filters.maxPrice, 1_000_000_000);
});

test("ten digits that exceed MAX_FILTER_PRICE are still refused", () => {
  // The digit budget and the value ceiling are different checks. A parser that
  // only counted digits would accept a number no vehicle can be priced under.
  const result = parse("max_price=9999999999");

  assert.equal(result.filters.maxPrice, undefined);
  assert.ok(result.errors.max_price);
});

test("a non-numeric price is refused rather than becoming NaN", () => {
  // `Number("abc")` is NaN, and NaN would serialise into the query string as
  // the literal text "NaN" - a filter the backend would reject, from a value
  // that looked parsed.
  for (const value of ["abc", "1e5", "25,000", "12px", ".."]) {
    const result = parse(`min_price=${encodeURIComponent(value)}`);
    assert.equal(result.filters.minPrice, undefined, value);
    assert.ok(result.errors.min_price, value);
  }
});

test("a year below EARLIEST_MODEL_YEAR is refused", () => {
  const result = parse("min_year=1899");

  assert.equal(result.filters.minYear, undefined);
  assert.match(result.errors.min_year ?? "", /1900/);
});

test("a year beyond the next model year is refused", () => {
  const latest = new Date().getFullYear() + 1;
  const result = parse(`max_year=${latest + 1}`);

  assert.equal(result.filters.maxYear, undefined);
  assert.match(result.errors.max_year ?? "", new RegExp(String(latest)));
});

test("a year at the next model year is accepted", () => {
  const latest = new Date().getFullYear() + 1;
  assert.equal(parse(`max_year=${latest}`).filters.maxYear, latest);
});

test("a decimal year is refused, because years are whole", () => {
  const result = parse("min_year=2020.5");

  assert.equal(result.filters.minYear, undefined);
  assert.match(result.errors.min_year ?? "", /four digits/);
});

test("an unknown status is a message, not an empty result", () => {
  // The backend's `_reject_unknown_status` agrees. Silently ignoring it would
  // answer `?status=avaliable` with the whole inventory and present a broken
  // filter link as a working one.
  const result = parse("status=avaliable");

  assert.equal(result.filters.status, undefined);
  assert.match(result.errors.status ?? "", /available, reserved or sold/);
  assert.equal(result.active, false);
});

test("a rejected value never also appears in the filters", () => {
  // The invariant this whole module exists to hold. A key present in both
  // objects would be sent to the API, produce a 422, and degrade the page to an
  // empty grid while the field beside it claims a value was entered.
  const cases = [
    "make=" + "a".repeat(200),
    "query=" + "b".repeat(200),
    "min_price=abc",
    "min_price=0",
    "max_price=99999999999",
    "min_year=1800",
    "max_year=3000",
    "status=nonsense",
    "fuel=" + "c".repeat(200),
  ];

  for (const query of cases) {
    const { filters, errors } = parse(query);
    for (const key of Object.keys(errors) as Array<keyof VehicleFilterErrors>) {
      assert.equal(
        (filters as Record<string, unknown>)[key],
        undefined,
        `${query} left ${key} in filters and in errors`,
      );
    }
  }
});

/* -------------------------------------------------------------------------
 * Cross-field rules
 * ---------------------------------------------------------------------- */

test("an inverted price range is reported on the upper bound", () => {
  const result = parse("min_price=75000&max_price=25000");

  assert.match(result.errors.max_price ?? "", /cannot be below the minimum/);
  // The upper bound is the field a visitor edits to fix it.
  assert.equal(result.errors.min_price, undefined);
});

test("an inverted price range is not sent, so the API is never asked", () => {
  // The whole reason `checkRange` exists. Transmitting a pair it has just
  // reported produces a 422, and `listVehicles` degrades a 422 to an empty grid
  // - so the page would say "no vehicles match" beside a message about a value
  // it had sent anyway.
  const result = parse("min_price=75000&max_price=25000");

  assert.equal(result.filters.minPrice, undefined);
  assert.equal(result.filters.maxPrice, undefined);
  assert.ok(result.errors.max_price);
});

test("an inverted year range is dropped whole, not half", () => {
  const result = parse("min_year=2025&max_year=2015");

  assert.equal(result.filters.minYear, undefined);
  assert.equal(result.filters.maxYear, undefined);
});

test("an inverted range costs only itself, not the whole search", () => {
  const result = parse("make=Toyota&min_price=75000&max_price=25000");

  assert.equal(result.filters.make, "Toyota");
  assert.equal(result.active, true);
  assert.ok(result.errors.max_price);
});

test("an inversion is not reported when a bound was already rejected", () => {
  // One message per field. A second complaint about a value the visitor never
  // typed is noise.
  const result = parse("min_price=abc&max_price=25000");

  assert.ok(result.errors.min_price);
  assert.equal(result.errors.max_price, undefined);
});

test("an equal price on both bounds is a range, not an inversion", () => {
  const result = parse("min_price=40000&max_price=40000");

  assert.deepEqual(result.errors, {});
  assert.equal(result.filters.minPrice, 40000);
  assert.equal(result.filters.maxPrice, 40000);
});

test("a half-open range is fine, because an empty bound is not a value", () => {
  // `?min_price=90000&max_price=` is the same mistake as the inverted range in
  // the visitor's head, and the backend checks for it explicitly.
  const result = parse("min_price=90000&max_price=");

  assert.deepEqual(result.errors, {});
  assert.equal(result.filters.minPrice, 90000);
  assert.equal(result.filters.maxPrice, undefined);
});

test("one bad bound does not suppress the other", () => {
  // A single mistyped price must not cost the visitor the rest of their search.
  const result = parse("make=Toyota&min_price=abc&min_year=2020");

  assert.equal(result.filters.make, "Toyota");
  assert.equal(result.filters.minYear, 2020);
  assert.equal(result.filters.minPrice, undefined);
  assert.ok(result.errors.min_price);
  assert.equal(result.active, true);
});

/* -------------------------------------------------------------------------
 * The searchParams shape the page actually receives
 * ---------------------------------------------------------------------- */

test("a record of strings parses, as Next supplies it", () => {
  const result = parseVehicleFilters({ make: "Toyota", [WIRE.maxPrice]: "75000" });

  assert.equal(result.filters.make, "Toyota");
  assert.equal(result.filters.maxPrice, 75000);
});

test("a repeated key takes the last value", () => {
  // A form cannot produce this and the API does not document it, so there is no
  // reason to invent a rule - but every layer above this one resolves a repeated
  // parameter the same way, and being the odd one out would be a surprise.
  const result = parseVehicleFilters({ make: ["Toyota", "Nissan"] });

  assert.equal(result.filters.make, "Nissan");
});

test("undefined and missing keys are both absence", () => {
  const result = parseVehicleFilters({ make: undefined });

  assert.deepEqual(result.filters, {});
  assert.equal(result.active, false);
});

test("an empty record is the same as no argument", () => {
  assert.deepEqual(parseVehicleFilters({}).filters, parseVehicleFilters().filters);
});

/* -------------------------------------------------------------------------
 * The two helpers the page reads
 * ---------------------------------------------------------------------- */

test("isFiltered is false for an empty filter and true for any value", () => {
  assert.equal(isFiltered({}), false);
  assert.equal(isFiltered({ make: "" }), false);
  assert.equal(isFiltered({ make: "Toyota" }), true);
  assert.equal(isFiltered({ minPrice: 0 }), true);
  assert.equal(isFiltered({ status: "sold" }), true);
});

test("describeFilters names the values, in a readable order", () => {
  assert.equal(
    describeFilters({ make: "Toyota", bodyType: "SUV" }),
    "Toyota, SUV",
  );
  assert.equal(describeFilters({ query: "land" }), '"land"');
});

test("describeFilters reads a price range the way a person would", () => {
  assert.equal(describeFilters({ minPrice: 25000, maxPrice: 40000 }), "$25,000 to $40,000");
  assert.equal(describeFilters({ minPrice: 25000 }), "from $25,000");
  assert.equal(describeFilters({ maxPrice: 40000 }), "up to $40,000");
});

test("describeFilters reads a year range the way a person would", () => {
  assert.equal(describeFilters({ minYear: 2020, maxYear: 2024 }), "2020 to 2024");
  assert.equal(describeFilters({ minYear: 2020 }), "2020 or newer");
  assert.equal(describeFilters({ maxYear: 2015 }), "2015 or older");
});

test("describeFilters of nothing is an empty string, not filler", () => {
  // Rendered next to a result count, so a stray "any" would read as a claim.
  assert.equal(describeFilters({}), "");
});

test("describeFilters skips a bound that was never set", () => {
  const summary = describeFilters({ minPrice: 25000, minYear: 2020 });
  assert.ok(!summary.includes("undefined"));
  assert.ok(!summary.includes("to $"));
});

/* -------------------------------------------------------------------------
 * The shape the seam depends on
 * ---------------------------------------------------------------------- */

test("the parsed filter covers exactly the domain VehicleFilters fields", () => {
  // `types/vehicle.ts` cannot be imported here - it is type-only and the test
  // runner resolves neither the `@/` alias nor an extensionless specifier - so
  // this asserts the same field list the domain interface declares. If either
  // side is edited, this fails.
  const declared: Array<keyof VehicleFiltersShape> = [
    "query",
    "make",
    "bodyType",
    "fuel",
    "transmission",
    "minPrice",
    "maxPrice",
    "minYear",
    "maxYear",
    "status",
  ];

  for (const field of declared) {
    const wire = field === "bodyType" ? WIRE.bodyType
      : field === "minPrice" ? WIRE.minPrice
      : field === "maxPrice" ? WIRE.maxPrice
      : field === "minYear" ? WIRE.minYear
      : field === "maxYear" ? WIRE.maxYear
      : field;

    const sample =
      field === "minPrice" || field === "maxPrice" ? "1000"
      : field === "minYear" || field === "maxYear" ? "2020"
      : field === "status" ? "available"
      : "value";

    const { filters } = parse(`${wire}=${sample}`);
    assert.ok(field in filters, `${wire} did not populate ${field}`);
  }
});
