/**
 * The comparison's parsing and resolution, pinned.
 *
 * ---------------------------------------------------------------------------
 * What these tests are for
 * ---------------------------------------------------------------------------
 * This module is the only place in the feature that reads attacker-controlled
 * input. A comparison's correctness is mostly about refusing bad input without
 * becoming either a crash or a lie:
 *
 *   - **Too many slugs.** `?vehicles=` repeated without limit is a public page
 *     doing work on demand, and a table nobody can read. The cap has to hold.
 *   - **One car shown as two.** A repeated slug in the address would make a
 *     single vehicle occupy two columns, which is the one thing a comparison
 *     must never do.
 *   - **Junk silently dropped.** A value that is not a valid address should be
 *     *reported*, not quietly ignored, or a hand-edited link fails with no
 *     explanation.
 *   - **A missing car killing the table.** One archived vehicle in a shared link
 *     must not cost the visitor the other three.
 *
 * ---------------------------------------------------------------------------
 * The inputs below are fixture data, not inventory
 * ---------------------------------------------------------------------------
 * The same convention as every other test in this project: nothing here is
 * imported by the application, and no vehicle reaches a page from it.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  COMPARISON_KEY,
  MAX_COMPARISON,
  MIN_COMPARISON,
  comparePath,
  isComparable,
  parseComparison,
  resolveComparison,
  withoutVehicle,
} from "./compare.ts";
import type { Vehicle } from "@/types/vehicle";

/** Minimal valid domain vehicle. Only the fields the comparison reads matter. */
function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "id",
    slug: "toyota-land-cruiser",
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

/** The live shape: 13 published vehicles across three makes, mostly unpriced. */
const CATALOGUE: Vehicle[] = [
  vehicle({ slug: "nissan-patrol-v8", make: "Nissan", model: "Patrol", year: 2023, price: null, fuel: "Petrol" }),
  vehicle({ slug: "mercedes-amg-g63", make: "Mercedes-Benz", model: "AMG G63", year: 2025, price: null, mileage: 12000 }),
  vehicle({ slug: "mercedes-x250d", make: "Mercedes-Benz", model: "X250d", year: 2021, price: null }),
  vehicle({ slug: "mercedes-x250d-2", make: "Mercedes-Benz", model: "x250d", year: 2020, price: null }),
  vehicle({ slug: "toyota-land-cruiser-prado", make: "Toyota", model: "Land Cruiser Prado", year: 2025, price: null }),
  vehicle({ slug: "toyota-land-cruiser-hardtop", make: "Toyota", model: "Land Cruiser", year: 2017, price: 25000, mileage: 145000 }),
  vehicle({ slug: "toyota-land-cruiser-vxr", make: "Toyota", model: "Land Cruiser VXR", year: 2024, price: 75000, mileage: 8000 }),
  vehicle({ slug: "toyota-hilux", make: "Toyota", model: "Hilux", year: 2023, price: null, bodyType: "pick up" }),
];

/* -------------------------------------------------------------------------
 * Reading the selection
 * ---------------------------------------------------------------------- */

test("an absent selection is an empty one, not an error", () => {
  // The page's arrival state. `/compare` on its own must render a picker, so
  // this cannot be a failure path.
  for (const empty of [{}, { vehicles: undefined }] as Record<string, string | string[] | undefined>[]) {
    const request = parseComparison(empty);
    assert.deepEqual(request.slugs, []);
    assert.equal(request.truncated, false);
  }
});

test("repeated keys are read, because that is what a checkbox form submits", () => {
  // A native GET form cannot join its values, so this is the shape the feature
  // actually produces - not an edge case.
  const request = parseComparison({
    vehicles: ["toyota-land-cruiser", "nissan-patrol-v8"],
  });

  assert.deepEqual(request.slugs, ["toyota-land-cruiser", "nissan-patrol-v8"]);
});

test("a comma-separated list is read, because that is what a person types", () => {
  // The other natural shape. Supporting only the form's would make a hand-edited
  // link silently compare one vehicle whose slug is "a,b".
  const request = parseComparison({ vehicles: "toyota-land-cruiser,nissan-patrol-v8" });

  assert.deepEqual(request.slugs, ["toyota-land-cruiser", "nissan-patrol-v8"]);
});

test("both shapes together are all read", () => {
  const request = parseComparison({
    vehicles: ["toyota-land-cruiser,nissan-patrol-v8", "toyota-hilux"],
  });

  assert.deepEqual(request.slugs, [
    "toyota-land-cruiser",
    "nissan-patrol-v8",
    "toyota-hilux",
  ]);
});

test("URLSearchParams is read the same way as the record Next hands the page", () => {
  // Next 16 gives `searchParams` as a plain record, but the lib boundary also
  // accepts `URLSearchParams`, and the two must not disagree.
  const query = new URLSearchParams();
  query.append(COMPARISON_KEY, "toyota-land-cruiser");
  query.append(COMPARISON_KEY, "nissan-patrol-v8");

  assert.deepEqual(
    parseComparison(query).slugs,
    parseComparison({ vehicles: ["toyota-land-cruiser", "nissan-patrol-v8"] }).slugs,
  );
});

test("a value is normalised exactly as a detail-page slug is", () => {
  // `getVehicleBySlug` trims and lowercases before matching. If this normalised
  // differently, a value that opens a vehicle page would fail to compare it.
  const request = parseComparison({ vehicles: "  TOYOTA-Land-Cruiser  " });

  assert.deepEqual(request.slugs, ["toyota-land-cruiser"]);
});

test("the visitor's order is preserved", () => {
  // A comparison is chosen left to right. Sorting would silently rearrange which
  // car is "first" against which.
  const request = parseComparison({ vehicles: "c-slug,a-slug,b-slug" });

  assert.deepEqual(request.slugs, ["c-slug", "a-slug", "b-slug"]);
});

/* -------------------------------------------------------------------------
 * Refusing hostile input
 * ---------------------------------------------------------------------- */

test("the selection is capped, so a link cannot demand unbounded work", () => {
  // The reason for the cap. 50,000 slugs in a URL is a cheap way to make a public
  // page resolve 50,000 values, and it is also unreadable past four columns.
  const many = Array.from({ length: 500 }, (_, index) => `car-${index}`).join(",");
  const request = parseComparison({ vehicles: many });

  assert.equal(request.slugs.length, MAX_COMPARISON);
  assert.equal(request.truncated, true);
  assert.equal(request.overLimit.length, 496);
});

test("the cap holds across repeated keys too, not just commas", () => {
  const request = parseComparison({
    vehicles: Array.from({ length: 200 }, (_, index) => `car-${index}`),
  });

  assert.equal(request.slugs.length, MAX_COMPARISON);
});

test("a single value cannot smuggle past the cap by being enormous", () => {
  // The length guard runs before the cap, so a megabyte in one parameter is
  // refused rather than split into thousands of slugs.
  const request = parseComparison({ vehicles: `car,${"a".repeat(5000)}` });

  assert.equal(request.slugs.length, 1);
  assert.equal(request.malformed.length, 1);
});

test("a value that is not a slug shape is reported, not dropped in silence", () => {
  // Each of these would be refused by the stored-slug contract. A silent drop
  // would make a hand-edited link fail with nothing to explain why.
  const junk = [
    "Toyota Land Cruiser", // spaces
    "toyota_land_cruiser", // underscores
    "toyota/land-cruiser", // a path separator
    "<script>", // markup
    "toyota--land", // a doubled hyphen
    "-toyota", // a leading hyphen
    "toyota-", // a trailing hyphen
    "..", // traversal
    "a".repeat(121), // longer than the column
  ];

  for (const value of junk) {
    const request = parseComparison({ vehicles: value });
    assert.deepEqual(request.slugs, [], `expected ${value} to be refused`);
    assert.equal(request.malformed.length, 1, `expected ${value} to be reported`);
  }
});

test("an empty value is not reported as malformed, because it is nothing", () => {
  // `?vehicles=` and a trailing comma are the shapes a form produces when
  // nothing is ticked. Calling that malformed would show a visitor an error for
  // the ordinary case of "I have not chosen yet".
  for (const value of ["", " , ", ",,"]) {
    const request = parseComparison({ vehicles: value });
    assert.deepEqual(request.slugs, []);
    assert.deepEqual(request.malformed, []);
  }
});

test("a repeated slug is one vehicle, never two columns", () => {
  // The single most important invariant here: a comparison must not be able to
  // show one car twice and call it a comparison.
  const request = parseComparison({
    vehicles: ["toyota-land-cruiser", "TOYOTA-LAND-CRUISER", " toyota-land-cruiser "],
  });

  assert.deepEqual(request.slugs, ["toyota-land-cruiser"]);
});

test("a bad value does not consume a place in the cap", () => {
  // Otherwise five values of which two are junk would show two cars and report a
  // truncation that never happened.
  const request = parseComparison({ vehicles: ["a-one", "not a slug", "b-two", "!!", "c-three", "d-four"] });

  assert.deepEqual(request.slugs, ["a-one", "b-two", "c-three", "d-four"]);
  assert.equal(request.truncated, false);
  assert.equal(request.malformed.length, 2);
});

/* -------------------------------------------------------------------------
 * Resolving against the catalogue
 * ---------------------------------------------------------------------- */

test("a valid selection resolves to those vehicles, in the order asked", () => {
  const result = resolveComparison(CATALOGUE, ["toyota-hilux", "nissan-patrol-v8"]);

  assert.deepEqual(
    result.vehicles.map((v) => v.slug),
    ["toyota-hilux", "nissan-patrol-v8"],
  );
  assert.deepEqual(result.unmatched, []);
  assert.equal(result.overflow, 0);
});

test("one unknown slug costs the others nothing", () => {
  // The shared-link case: a car has been archived since the link was sent. The
  // page must still compare what it can, because a dead comparison over one
  // missing car would be a worse answer than a shorter one.
  const result = resolveComparison(CATALOGUE, [
    "toyota-land-cruiser-vxr",
    "sold-and-archived",
    "nissan-patrol-v8",
  ]);

  assert.deepEqual(
    result.vehicles.map((v) => v.slug),
    ["toyota-land-cruiser-vxr", "nissan-patrol-v8"],
  );
  assert.deepEqual(result.unmatched, ["sold-and-archived"]);
});

test("every slug unknown is an empty table, not a crash", () => {
  const result = resolveComparison(CATALOGUE, ["gone-one", "gone-two"]);

  assert.deepEqual(result.vehicles, []);
  assert.deepEqual(result.unmatched, ["gone-one", "gone-two"]);
  assert.equal(isComparable(result.vehicles.length), false);
});

test("resolution is case-insensitive, matching the detail page", () => {
  const result = resolveComparison(CATALOGUE, ["TOYOTA-HILUX"]);

  assert.equal(result.vehicles[0]?.slug, "toyota-hilux");
});

test("two vehicles that differ only by model casing are still two vehicles", () => {
  // The live catalogue holds `X250d` and `x250d` as separate cars, and the whole
  // point of a comparison is telling those two apart. Slug identity, not model
  // identity, decides which car a column is.
  const result = resolveComparison(CATALOGUE, ["mercedes-x250d", "mercedes-x250d-2"]);

  assert.equal(result.vehicles.length, 2);
  assert.deepEqual(
    result.vehicles.map((v) => v.model),
    ["X250d", "x250d"],
  );
});

test("one vehicle cannot fill two columns, whatever the address says", () => {
  // Belt and braces with the parse-time de-duplication: even if a duplicate
  // reached here, resolution refuses to render it twice.
  const result = resolveComparison(CATALOGUE, ["toyota-hilux", "toyota-hilux", "toyota-hilux"]);

  assert.equal(result.vehicles.length, 1);
});

test("resolution caps at the same limit as parsing, and counts the rest", () => {
  // The cap is enforced twice, deliberately: parsing bounds the request, and
  // resolution bounds the table, so neither can be bypassed by the other being
  // changed. The overflow is *counted* because the cars are real - the visitor
  // asked for six and four fit.
  const result = resolveComparison(CATALOGUE, [
    "toyota-hilux",
    "nissan-patrol-v8",
    "mercedes-amg-g63",
    "mercedes-x250d",
    "mercedes-x250d-2",
    "toyota-land-cruiser-prado",
  ]);

  assert.equal(result.vehicles.length, MAX_COMPARISON);
  assert.equal(result.overflow, 2);
  assert.equal(result.unmatched.length, 0);
});

test("a vehicle absent from the catalogue never appears", () => {
  // The single check that keeps unpublished stock out of a comparison. A draft
  // leaking here would sit beside three real cars, where nobody would notice.
  const withDraft = [...CATALOGUE, vehicle({ slug: "unpublished-draft", status: "available" })];
  const result = resolveComparison(withDraft, ["unpublished-draft"]);

  // `resolveComparison` is handed only what the public list returned, so the
  // guarantee is structural: it cannot invent a vehicle that is not in the array.
  // This test pins that the function adds nothing of its own.
  assert.equal(result.vehicles.length, 1);
  assert.equal(result.vehicles[0]?.slug, "unpublished-draft");
  assert.deepEqual(
    resolveComparison(CATALOGUE, ["unpublished-draft"]).vehicles,
    [],
    "with only published rows passed in, the draft resolves to nothing",
  );
});

/* -------------------------------------------------------------------------
 * Is this a comparison at all?
 * ---------------------------------------------------------------------- */

test("one vehicle is not a comparison", () => {
  assert.equal(MIN_COMPARISON, 2);
  assert.equal(isComparable(1), false);
  assert.equal(isComparable(2), true);
  assert.equal(isComparable(4), true);
});

/* -------------------------------------------------------------------------
 * The addresses
 * ---------------------------------------------------------------------- */

test("a comparison address is a real, shareable URL", () => {
  // The whole reason selection lives in the query string: a visitor can send
  // this to someone else and both see the same two cars.
  assert.equal(
    comparePath(["toyota-land-cruiser", "nissan-patrol-v8"]),
    "/compare?vehicles=toyota-land-cruiser&vehicles=nissan-patrol-v8",
  );
});

test("a generated address parses back to the same selection", () => {
  // The round trip that makes the two halves of the feature agree. A builder and
  // a parser that disagree would produce a link that silently compares nothing.
  //
  // Parsed from the address's *query*, which is what Next hands the page as
  // `searchParams` - the parser is given query values, never a whole path, so
  // feeding it `/compare?vehicles=...` would test a shape nothing produces.
  const slugs = ["toyota-hilux", "mercedes-amg-g63", "nissan-patrol-v8"];
  const query = new URL(comparePath(slugs), "https://example.test").searchParams;

  assert.deepEqual(parseComparison(query).slugs, slugs);
});

test("a slug is encoded on the way into the address", () => {
  // A slug is a URL segment assembled from input in JavaScript, so it is encoded
  // for the same reason `makePath` encodes a make. Reached through the parser's
  // own pattern check, which refuses these anyway - so this asserts the
  // *defence in depth*: if the pattern ever loosens, the encoding still holds.
  const path = comparePath(["a b&c=d"]);

  assert.equal(path, "/compare?vehicles=a%20b%26c%3Dd");
  assert.equal(new URL(path, "https://x.test").searchParams.getAll(COMPARISON_KEY).length, 1);
});

test("an empty selection is the bare route, not a route with an empty query", () => {
  // `/compare?` is what a naive join produces and it reads as a broken link in
  // the address bar and in a shared message. Every removal link is generated by
  // `withoutVehicle`, so an emptied selection reaches this path on a real page.
  assert.equal(comparePath([]), "/compare");
  assert.equal(comparePath([""]), "/compare");

  // And it round-trips: the bare route is a selection of nothing, not a failure.
  const query = new URL(comparePath([]), "https://x.test").searchParams;
  assert.deepEqual(parseComparison(query).slugs, []);
  assert.deepEqual(parseComparison(query).malformed, []);
});

test("removing a vehicle leaves the rest, and is a link rather than a state change", () => {
  // Removal is navigation, so Back undoes it and the address bar is always the
  // current comparison.
  const slugs = ["toyota-hilux", "nissan-patrol-v8", "toyota-land-cruiser-prado"];

  assert.equal(
    withoutVehicle(slugs, "nissan-patrol-v8"),
    "/compare?vehicles=toyota-hilux&vehicles=toyota-land-cruiser-prado",
  );
});

test("removing the last vehicle leaves the picker, not an empty table", () => {
  assert.equal(withoutVehicle(["toyota-hilux"], "toyota-hilux"), "/compare");
  assert.equal(withoutVehicle(["toyota-hilux", "nissan-patrol-v8"], "toyota-hilux"), "/compare?vehicles=nissan-patrol-v8");
});

test("removing something not in the selection changes nothing", () => {
  const slugs = ["toyota-hilux", "nissan-patrol-v8"];

  assert.equal(withoutVehicle(slugs, "some-other-car"), comparePath(slugs));
});

test("a removal target is matched case-insensitively, as slugs are", () => {
  assert.equal(withoutVehicle(["toyota-hilux", "nissan-patrol-v8"], "TOYOTA-HILUX"), "/compare?vehicles=nissan-patrol-v8");
});
