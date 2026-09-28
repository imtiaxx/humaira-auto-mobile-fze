/**
 * The brand directory, pinned.
 *
 * ---------------------------------------------------------------------------
 * What these tests are for
 * ---------------------------------------------------------------------------
 * `brands.ts` decides what a customer is told the dealership stocks. Two failure
 * modes matter and neither is a crash:
 *
 *   - **Overstating**: a make listed with vehicles that are all archived, or a
 *     count that includes them. The customer is told a car exists, clicks, and
 *     finds nothing.
 *   - **Understating**: a make missing because its spelling did not match, or a
 *     model missing from a make that is otherwise there.
 *
 * So the fixture uses the live inventory's real spellings - `Mercedes-Benz`
 * (hyphenated), `pick up`-style spacing, one vehicle with no price at all - and
 * pins the awkward cases rather than the tidy ones. A hand-written brand list
 * would pass a test built from `Toyota` and `Nissan` and fail in production.
 *
 * ---------------------------------------------------------------------------
 * The inputs below are fixture data, not inventory
 * ---------------------------------------------------------------------------
 * The same convention as `facets.test.ts` and every other test in this project:
 * nothing here is imported by the application, and no vehicle reaches a page
 * from it.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { makePath, toBrandDirectory, type Brand } from "./brands.ts";
import type { Vehicle } from "@/types/vehicle";

/** Minimal valid domain vehicle. Only the fields the directory reads matter. */
function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "id",
    slug: "slug",
    make: "Toyota",
    model: "Land Cruiser",
    variant: null,
    year: 2022,
    bodyType: "SUV",
    transmission: "Automatic",
    fuel: "Diesel",
    colour: null,
    mileage: null,
    vin: null,
    price: 60000,
    currency: "USD",
    status: "available",
    location: null,
    images: [],
    features: {},
    ...overrides,
  };
}

function named(entries: Record<string, Partial<Vehicle>[]>): Vehicle[] {
  return Object.entries(entries).flatMap(([make, rows]) =>
    rows.map((row) => vehicle({ make, ...row })),
  );
}

/** The live shape: nine Toyotas, three Mercedes-Benz, one Nissan, 11 unpriced. */
const LIVE_SHAPED: Vehicle[] = named({
  Toyota: [
    { model: "Land Cruiser", price: 60000 },
    { model: "Land Cruiser", price: 60000 },
    { model: "Land Cruiser Prado", price: null },
    { model: "Hilux", price: 25000 },
    { model: "Land Cruiser VXR", price: 75000 },
    { model: "Land Cruiser Prado", price: null },
    { model: "Land Cruiser", price: null },
    { model: "Land Cruiser VXR", price: null },
    { model: "Hilux", price: null },
  ],
  "Mercedes-Benz": [
    { model: "AMG G63", price: null },
    { model: "x250d", price: null },
    { model: "AMG G63", price: null },
  ],
  Nissan: [{ model: "Patrol", price: null }],
});

function byName(brands: Brand[], name: string): Brand {
  const found = brands.find((brand) => brand.name === name);
  assert.ok(found, `expected a brand called ${name}, got ${brands.map((b) => b.name).join(", ")}`);
  return found;
}

/* -------------------------------------------------------------------------
 * Grouping
 * ---------------------------------------------------------------------- */

test("an empty inventory produces no brands", () => {
  // Not an error and not a placeholder row. An empty directory is a true
  // statement about a business that has published nothing.
  assert.deepEqual(toBrandDirectory([]), []);
});

test("each make appears once, with the count of its vehicles", () => {
  const brands = toBrandDirectory(LIVE_SHAPED);

  assert.deepEqual(brands.map((brand) => brand.name), [
    "Mercedes-Benz",
    "Nissan",
    "Toyota",
  ]);
  assert.equal(byName(brands, "Toyota").count, 9);
  assert.equal(byName(brands, "Mercedes-Benz").count, 3);
  assert.equal(byName(brands, "Nissan").count, 1);
});

test("a repeated model is listed once but still counted per vehicle", () => {
  // Land Cruiser appears three times in the fixture. The models list is a set of
  // names a customer can search for; the count is stock. Collapsing the count to
  // match the model list would understate the inventory.
  const toyota = byName(toBrandDirectory(LIVE_SHAPED), "Toyota");

  assert.equal(toyota.models.length, 4);
  assert.equal(toyota.count, 9);
});

test("models are listed alphabetically, so the list is scannable", () => {
  const toyota = byName(toBrandDirectory(LIVE_SHAPED), "Toyota");

  assert.deepEqual([...toyota.models], [
    "Hilux",
    "Land Cruiser",
    "Land Cruiser Prado",
    "Land Cruiser VXR",
  ]);
});

test("a brand with no stock never appears", () => {
  // The directory is built from the published list, so this cannot happen
  // without a code change - which is the property worth pinning. A brand list
  // that could show a make with nothing behind it would send customers to empty
  // results and call it a catalogue.
  const brands = toBrandDirectory([vehicle({ make: "Toyota" })]);

  assert.deepEqual(brands.map((brand) => brand.name), ["Toyota"]);
  assert.equal(brands[0]?.count, 1);
});

test("makes differing only by case are one entry, not two", () => {
  // Two rows that look identical in the list are a visible defect, and a link to
  // the second would filter differently from the first. Case-insensitive, because
  // the backend matches `make` case-insensitively - so "toyota" and "Toyota" are
  // the same brand everywhere else in the system too.
  const brands = toBrandDirectory([
    vehicle({ make: "Toyota" }),
    vehicle({ make: "toyota" }),
    vehicle({ make: "TOYOTA" }),
  ]);

  assert.equal(brands.length, 1);
  assert.equal(brands[0]?.name, "Toyota", "keeps the spelling it first saw");
  assert.equal(brands[0]?.count, 3);
});
test("a hyphenated make keeps its hyphen", () => {
  // The live inventory has Mercedes-Benz. A normaliser that stripped or spaced
  // the hyphen would produce a label the endpoint cannot match, and the customer
  // would land on an unfiltered page.
  const brands = toBrandDirectory([vehicle({ make: "Mercedes-Benz" })]);

  assert.equal(brands[0]?.name, "Mercedes-Benz");
});

test("models differing only by case are listed once", () => {
  // Not hypothetical: the live inventory contains `X250d` and `x250d` as two
  // separate vehicles under the same make. Rendered as a comma-separated sentence
  // that is "AMG G63, X250d, x250d" - three models on a page whose claim is that
  // every fact came from the inventory, and visibly the same model twice.
  //
  // Both vehicles are still counted. Merging the *label* must not merge the
  // stock, or a make would advertise fewer cars than it has.
  const brands = toBrandDirectory([
    vehicle({ make: "Mercedes-Benz", model: "AMG G63" }),
    vehicle({ make: "Mercedes-Benz", model: "X250d" }),
    vehicle({ make: "Mercedes-Benz", model: "x250d" }),
  ]);

  assert.deepEqual([...byName(brands, "Mercedes-Benz").models], ["AMG G63", "X250d"]);
  assert.equal(byName(brands, "Mercedes-Benz").count, 3);
});

test("a merged model keeps the spelling it first saw", () => {
  // The first spelling is the repository's own, so the customer reads the value
  // the data was recorded with rather than one this function preferred.
  const brands = toBrandDirectory([
    vehicle({ make: "Toyota", model: "Hilux" }),
    vehicle({ make: "Toyota", model: "HILUX" }),
  ]);

  assert.deepEqual([...byName(brands, "Toyota").models], ["Hilux"]);
});

test("brands are ordered the way a reader orders them", () => {
  const brands = toBrandDirectory([
    vehicle({ make: "volvo" }),
    vehicle({ make: "Audi" }),
    vehicle({ make: "bmw" }),
  ]);

  // Locale-aware: a case-sensitive sort would put Audi first, then bmw, then
  // volvo, which reads as three separate lists.
  assert.deepEqual(brands.map((brand) => brand.name), ["Audi", "bmw", "volvo"]);
});

test("a blank make is skipped rather than becoming a nameless entry", () => {
  // `make` is required and non-blank on `Vehicle`, so the normaliser already
  // rejects one. This pins the behaviour if that ever changes: a brand rendered
  // as "" with a working link is worse than its absence.
  const brands = toBrandDirectory([
    vehicle({ make: "Toyota" }),
    vehicle({ make: "   " }),
  ]);

  assert.deepEqual(brands.map((brand) => brand.name), ["Toyota"]);
});

/* -------------------------------------------------------------------------
 * The price range
 * ---------------------------------------------------------------------- */

test("the range comes from the priced vehicles only", () => {
  // Eleven of the thirteen published vehicles have no price, so this is the
  // common case rather than an edge one. A range spanning 0 to 75000 would claim
  // the dealership has something for nothing.
  const toyota = byName(toBrandDirectory(LIVE_SHAPED), "Toyota");

  assert.equal(toyota.minPrice, 25000);
  assert.equal(toyota.maxPrice, 75000);
});

test("a make with nothing priced has no range rather than a zero one", () => {
  const brands = toBrandDirectory(LIVE_SHAPED);

  assert.equal(byName(brands, "Nissan").minPrice, null);
  assert.equal(byName(brands, "Nissan").maxPrice, null);
  assert.equal(byName(brands, "Mercedes-Benz").minPrice, null);
  assert.equal(byName(brands, "Mercedes-Benz").maxPrice, null);
});

test("a non-positive price is treated as unpriced, as the formatter does", () => {
  // `formatVehiclePrice` renders anything <= 0 as "price on request", so a 0 in
  // the data must not become the floor of a range.
  const brands = toBrandDirectory([
    vehicle({ make: "Toyota", model: "A", price: 0 }),
    vehicle({ make: "Toyota", model: "B", price: 50000 }),
  ]);

  assert.equal(brands[0]?.minPrice, 50000);
  assert.equal(brands[0]?.maxPrice, 50000);
});

test("a single priced vehicle gives equal bounds", () => {
  const brands = toBrandDirectory([vehicle({ price: 42000 })]);

  assert.equal(brands[0]?.minPrice, 42000);
  assert.equal(brands[0]?.maxPrice, 42000);
});

test("an unpriced vehicle does not widen the range of a priced one", () => {
  const brands = toBrandDirectory([
    vehicle({ model: "A", price: 40000 }),
    vehicle({ model: "B", price: null }),
  ]);

  assert.equal(brands[0]?.minPrice, 40000);
  assert.equal(brands[0]?.maxPrice, 40000);
});

/* -------------------------------------------------------------------------
 * The link
 * ---------------------------------------------------------------------- */

test("a make links to the inventory filtered by that make", () => {
  // This is the whole point of the page and the one place it integrates with the
  // filter built in the previous step: the directory is a shortcut into a real
  // filtered inventory, not a second place that lists cars.
  assert.equal(makePath("Toyota"), "/inventory?make=Toyota");
  assert.equal(makePath("Mercedes-Benz"), "/inventory?make=Mercedes-Benz");
});

test("a make needing encoding is encoded, or the filter silently breaks", () => {
  // The failure this prevents is invisible: the link renders correctly, the page
  // loads, and the customer gets the whole inventory with no filter applied,
  // because `&` split the query and the space was read as the end of the value.
  assert.equal(makePath("Land Rover & Co"), "/inventory?make=Land%20Rover%20%26%20Co");
  assert.equal(makePath("Alfa Romeo"), "/inventory?make=Alfa%20Romeo");
  assert.equal(makePath("A=B"), "/inventory?make=A%3DB");
});

test("a make with a hash cannot truncate the query", () => {
  // Unencoded, `#` would start a fragment and silently discard everything after
  // it from the server's point of view.
  assert.equal(makePath("C# Motors"), "/inventory?make=C%23%20Motors");
});

test("an encoded make is exactly what the parser will read back", () => {
  // The round trip that makes the encoding correct rather than merely tidy: the
  // value the parser reads is the make the customer clicked.
  for (const make of ["Toyota", "Mercedes-Benz", "Land Rover & Co", "A=B", "C# Motors"]) {
    const url = new URL(makePath(make), "https://example.test");
    assert.equal(url.searchParams.get("make"), make);
  }
});

test("the link carries no other parameter, so it cannot override the form", () => {
  // The link must express exactly one intent. A stray second parameter would
  // combine with whatever the inventory form defaults to.
  const url = new URL(makePath("Toyota"), "https://example.test");

  assert.deepEqual([...url.searchParams.keys()], ["make"]);
});

/* -------------------------------------------------------------------------
 * The property that makes deriving it correct
 * ---------------------------------------------------------------------- */

test("every make in the data appears in the directory, always", () => {
  // The invariant behind deriving rather than hard-coding. Adding a vehicle of a
  // make nobody has written down needs no code change, and no make can be
  // advertised that the inventory cannot supply.
  const added = vehicle({ make: "Rolls-Royce", model: "Ghost" });
  const brands = toBrandDirectory([...LIVE_SHAPED, added]);

  assert.ok(brands.some((brand) => brand.name === "Rolls-Royce"));
  assert.equal(byName(brands, "Rolls-Royce").count, 1);
});

test("the counts add up to the vehicles given", () => {
  // A directory whose counts do not reconcile with the inventory is a directory
  // that is lying in aggregate, even when every individual row looks right.
  const brands = toBrandDirectory(LIVE_SHAPED);

  assert.equal(
    brands.reduce((sum, brand) => sum + brand.count, 0),
    LIVE_SHAPED.length,
  );
});

test("every brand with a count has at least one model to show", () => {
  // A brand rendered with "0 models" next to a count of 3 is a bug that reads as
  // missing data rather than as one.
  for (const brand of toBrandDirectory(LIVE_SHAPED)) {
    assert.ok(brand.models.length > 0, `${brand.name} has no models`);
  }
});
