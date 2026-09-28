/**
 * The facet derivation, pinned.
 *
 * ---------------------------------------------------------------------------
 * What these tests are for
 * ---------------------------------------------------------------------------
 * `facets.ts` decides what the filter dropdowns offer. The failure that matters
 * is not a crash - it is offering a value the database does not contain, which
 * is a filter that returns nothing while looking perfectly operable, or dropping
 * a value it does contain, which is a vehicle a visitor cannot find.
 *
 * So the tests use the awkward cases rather than the tidy ones. The real
 * inventory contains `SUV` and `pick up` in the same body-type list - lowercase,
 * two words - and the tests use that shape deliberately, because a
 * case-sensitive sort and a hand-written taxonomy are the two ways this goes
 * wrong and neither shows up on `Toyota` / `Nissan` / `Sedan`.
 *
 * ---------------------------------------------------------------------------
 * The inputs below are fixture data, not inventory
 * ---------------------------------------------------------------------------
 * The same convention as every other test in this project: nothing here is
 * imported by the application, and no vehicle reaches a page from it.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { toVehicleFacets, type FacetOption } from "./facets.ts";
import type { Vehicle, VehicleStatus } from "@/types/vehicle";

/** Minimal valid domain vehicle. Only the fields a facet reads are meaningful. */
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
    status: "available" as VehicleStatus,
    location: null,
    images: [],
    features: {},
    ...overrides,
  };
}

/** The three makes, the two body types, the fuel split, as the live data has them. */
const FLEET: Vehicle[] = [
  vehicle({ make: "Toyota", bodyType: "SUV", fuel: "Diesel", price: 60000, year: 2022 }),
  vehicle({ make: "Toyota", bodyType: "pick up", fuel: "Gasoline", price: 25000, year: 2015 }),
  vehicle({ make: "Nissan", bodyType: "Hatchback", fuel: "Gasoline", price: 40000, year: 2020 }),
  vehicle({ make: "Mercedes-Benz", bodyType: "SUV", fuel: "Diesel", price: 75000, year: 2024 }),
  // A vehicle with nothing recorded in three of the four facet fields. One such
  // row exists in the live inventory and it is the reason the `null` handling
  // is tested rather than assumed.
  vehicle({ make: "Toyota", bodyType: null, fuel: null, transmission: null, price: null, year: 2018 }),
];

function values(options: readonly FacetOption[]): string[] {
  return options.map((option) => option.value);
}

/* -------------------------------------------------------------------------
 * Deriving the options
 * ---------------------------------------------------------------------- */

test("an empty inventory produces no options and no bounds", () => {
  const facets = toVehicleFacets([]);

  assert.deepEqual(facets.makes, []);
  assert.deepEqual(facets.bodyTypes, []);
  assert.deepEqual(facets.fuels, []);
  assert.deepEqual(facets.transmissions, []);
  assert.equal(facets.minPrice, null);
  assert.equal(facets.maxPrice, null);
  assert.equal(facets.minYear, null);
  assert.equal(facets.maxYear, null);
});

test("options are the distinct recorded values, with counts", () => {
  const facets = toVehicleFacets(FLEET);

  assert.deepEqual(values(facets.makes), ["Mercedes-Benz", "Nissan", "Toyota"]);
  assert.deepEqual(values(facets.bodyTypes), ["Hatchback", "pick up", "SUV"]);

  const toyota = facets.makes.find((option) => option.value === "Toyota");
  assert.equal(toyota?.count, 3);
});

test("an unrecorded value is not an option", () => {
  // The API excludes `NULL` from every facet filter, so offering "Unrecorded"
  // would be offering a control that cannot be satisfied. A vehicle with no
  // recorded fuel is not a diesel.
  const facets = toVehicleFacets(FLEET);

  assert.ok(!values(facets.fuels).includes(""));
  assert.equal(
    facets.fuels.reduce((sum, option) => sum + option.count, 0),
    4,
    "the row with no fuel recorded must not be counted as matching one",
  );
  assert.equal(
    facets.transmissions.length,
    1,
    "only Automatic is recorded, and one row records nothing",
  );
});

test("a blank string is treated as unrecorded, not as a value", () => {
  const facets = toVehicleFacets([vehicle({ bodyType: "   " })]);

  assert.deepEqual(facets.bodyTypes, []);
});

test("options keep the spelling the database has", () => {
  // The stored value is what gets sent, and the backend matches
  // case-insensitively - so nothing is lost by not normalising the value, and
  // something is lost by displaying a prettified one the database has never
  // heard of.
  const facets = toVehicleFacets(FLEET);

  assert.ok(values(facets.bodyTypes).includes("pick up"));
  assert.ok(!values(facets.bodyTypes).includes("Pick Up"));
});

test("values differing only by case are one option, not two", () => {
  // Two identical-looking entries in one dropdown is a visible defect, and a
  // filter on the second would return a different set than the first.
  const facets = toVehicleFacets([
    vehicle({ fuel: "Diesel" }),
    vehicle({ fuel: "diesel" }),
    vehicle({ fuel: "DIESEL" }),
  ]);

  assert.deepEqual(values(facets.fuels), ["Diesel"]);
  assert.equal(facets.fuels[0]?.count, 3);
});

test("options are sorted the way a reader sorts them, not by ASCII", () => {
  // The failure this pins: a case-sensitive sort puts `pick up` before `SUV`,
  // because a lower-case `p` sorts after an upper-case `S`. The dropdown then
  // reads as though the dealership classified a pickup before a sports utility.
  const facets = toVehicleFacets([vehicle({ bodyType: "SUV" }), vehicle({ bodyType: "pick up" })]);

  assert.deepEqual(values(facets.bodyTypes), ["pick up", "SUV"]);
});

/* -------------------------------------------------------------------------
 * The numeric bounds
 * ---------------------------------------------------------------------- */

test("price bounds come from the priced vehicles only", () => {
  const facets = toVehicleFacets(FLEET);

  assert.equal(facets.minPrice, 25000);
  assert.equal(facets.maxPrice, 75000);
});

test("a `null` price does not widen the range to zero", () => {
  const facets = toVehicleFacets([vehicle({ price: null })]);

  assert.equal(facets.minPrice, null);
  assert.equal(facets.maxPrice, null);
});

test("a non-positive price is treated as unpriced, as the formatter does", () => {
  // `formatVehiclePrice()` renders anything <= 0 as "Price on request", so a 0
  // in the data must not become the floor of the range: the hint would then say
  // the cheapest vehicle costs nothing.
  const facets = toVehicleFacets([vehicle({ price: 0 }), vehicle({ price: 50000 })]);

  assert.equal(facets.minPrice, 50000);
  assert.equal(facets.maxPrice, 50000);
});

test("year bounds are the oldest and newest published", () => {
  const facets = toVehicleFacets(FLEET);

  assert.equal(facets.minYear, 2015);
  assert.equal(facets.maxYear, 2024);
});

test("a single vehicle gives equal bounds", () => {
  const facets = toVehicleFacets([vehicle({ price: 42000, year: 2021 })]);

  assert.equal(facets.minPrice, 42000);
  assert.equal(facets.maxPrice, 42000);
  assert.equal(facets.minYear, 2021);
  assert.equal(facets.maxYear, 2021);
});

/* -------------------------------------------------------------------------
 * The property that makes this safe to derive rather than hard-code
 * ---------------------------------------------------------------------- */

test("a value that appears in the data appears in the options, always", () => {
  // The invariant behind deriving the options instead of writing them down: no
  // filter can be offered that the API cannot satisfy, and nothing recorded can
  // be unreachable. Adding a row with a new body type needs no code change.
  const added = vehicle({ bodyType: "Wagon", fuel: "Hybrid", transmission: "Manual" });
  const facets = toVehicleFacets([...FLEET, added]);

  assert.ok(values(facets.bodyTypes).includes("Wagon"));
  assert.ok(values(facets.fuels).includes("Hybrid"));
  assert.ok(values(facets.transmissions).includes("Manual"));
});

test("a vehicle with no price at all still yields facets", () => {
  // The live inventory is 11 of 13 unpriced, so this is the common case, not an
  // edge one. Dropping the whole control set because the prices are absent
  // would leave a visitor unable to filter by make.
  const facets = toVehicleFacets([vehicle({ price: null }), vehicle({ price: null })]);

  assert.deepEqual(values(facets.makes), ["Toyota"]);
  assert.equal(facets.maxPrice, null);
});
