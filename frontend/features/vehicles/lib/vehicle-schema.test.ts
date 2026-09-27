/**
 * The vehicle data boundary, pinned.
 *
 * ---------------------------------------------------------------------------
 * What these tests are for
 * ---------------------------------------------------------------------------
 * `vehicle-schema.ts` is the only thing standing between a JSON response and a
 * customer's screen. Every rule it enforces exists because the alternative is a
 * page that states something untrue: a price in a currency this site does not
 * quote, a "$0" that reads as a gift, a status guessed from a value the frontend
 * did not recognise, a photograph with a caption nobody wrote.
 *
 * Those failures are quiet. Nothing throws, nothing logs, and the page looks
 * fine. So the rules are asserted here rather than trusted.
 *
 * ---------------------------------------------------------------------------
 * The inputs below are validator test data, not inventory
 * ---------------------------------------------------------------------------
 * A normaliser cannot be tested without values to normalise. Everything in this
 * file is a test input: it is confined to this test file, nothing in the
 * application imports it, and it is not part of the production bundle.
 *
 * None of it is a listing. `listVehicles()` returns an empty array, so no
 * vehicle reaches a page from this repository, and the only way a vehicle is
 * rendered is through `listVehicles()`. The make, model and slug are realistic
 * purely so a failing assertion reads like the case it is about - a validator
 * tested only against obviously-fake data tends to pass for the wrong reasons.
 *
 * Note the file is written to be loadable by `node --test`, which does not
 * resolve the `@/` path alias. That is why the module under test imports its
 * types with `import type` and nothing else: same convention as `format.ts`.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  toInventoryPage,
  toVehicle,
  toVehicles,
} from "./vehicle-schema.ts";

/** A complete, valid wire record. Overridden field by field below. */
function record(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "veh_01",
    slug: "toyota-land-cruiser",
    make: "Toyota",
    model: "Land Cruiser",
    variant: null,
    year: 2024,
    body_type: null,
    transmission: null,
    fuel: null,
    colour: null,
    mileage_km: null,
    vin: null,
    price: null,
    currency: "USD",
    status: "available",
    location: null,
    images: null,
    features: null,
    ...overrides,
  };
}

/* -------------------------------------------------------------------------
 * The happy path
 * ---------------------------------------------------------------------- */

test("a complete record becomes a Vehicle", () => {
  const vehicle = toVehicle(
    record({
      variant: "L Limited",
      body_type: "SUV",
      transmission: "Automatic",
      fuel: "Hybrid",
      colour: "Pearl White",
      mileage_km: 52_000,
      vin: "JTMBR05E904123456",
      price: 87_500,
      location: "Ras Al Khor, Dubai",
    }),
  );

  assert.ok(vehicle);
  assert.equal(vehicle.id, "veh_01");
  assert.equal(vehicle.make, "Toyota");
  assert.equal(vehicle.model, "Land Cruiser");
  assert.equal(vehicle.variant, "L Limited");
  assert.equal(vehicle.bodyType, "SUV");
  assert.equal(vehicle.transmission, "Automatic");
  assert.equal(vehicle.fuel, "Hybrid");
  assert.equal(vehicle.colour, "Pearl White");
  assert.equal(vehicle.mileage, 52_000);
  assert.equal(vehicle.vin, "JTMBR05E904123456");
  assert.equal(vehicle.price, 87_500);
  assert.equal(vehicle.location, "Ras Al Khor, Dubai");
});

test("wire snake_case becomes the domain's camelCase", () => {
  const vehicle = toVehicle(record({ body_type: "Sedan", mileage_km: 1_000 }));
  assert.ok(vehicle);
  assert.equal(vehicle.bodyType, "Sedan");
  assert.equal(vehicle.mileage, 1_000);
});

test("a minimal record is still a valid vehicle", () => {
  const vehicle = toVehicle(record());
  assert.ok(vehicle);
  assert.deepEqual(vehicle.images, []);
  assert.deepEqual(vehicle.features, {});
  assert.equal(vehicle.price, null);
  assert.equal(vehicle.mileage, null);
  assert.equal(vehicle.status, "available");
  assert.equal(vehicle.currency, "USD");
});

/* -------------------------------------------------------------------------
 * USD, and only USD
 * ---------------------------------------------------------------------- */

test("USD is accepted in any casing, because backends are inconsistent", () => {
  for (const currency of ["USD", "usd", "Usd", " USD "]) {
    const vehicle = toVehicle(record({ currency }));
    assert.ok(vehicle, `${currency} should be accepted`);
    assert.equal(vehicle.currency, "USD");
  }
});

test("any other currency rejects the vehicle rather than converting it", () => {
  // Converting would mean inventing a rate, and an invented rate is a fabricated
  // price. There is no honest rendering of a non-USD figure on this site.
  for (const currency of ["AED", "EUR", "GBP", "PKR", "JPY", "US$", "dollars"]) {
    assert.equal(toVehicle(record({ currency })), null, `${currency} must be rejected`);
  }
});

test("a missing currency rejects the vehicle", () => {
  assert.equal(toVehicle(record({ currency: null })), null);
  assert.equal(toVehicle(record({ currency: undefined })), null);
});

/* -------------------------------------------------------------------------
 * Price: the same rule the formatter enforces
 * ---------------------------------------------------------------------- */

test("a positive price is kept as whole dollars", () => {
  const vehicle = toVehicle(record({ price: 35_000 }));
  assert.equal(vehicle?.price, 35_000);
});

test("a zero or negative price normalises to null, never to $0", () => {
  // Must agree with formatVehiclePrice(), which treats <= 0 as unpriced. If the
  // two ever disagree, a description can claim a price the page will not show.
  for (const price of [0, -1, -87_500]) {
    const vehicle = toVehicle(record({ price }));
    assert.equal(vehicle?.price, null, `${price} must normalise to null`);
  }
});

test("a non-numeric price normalises to null", () => {
  for (const price of ["35000", null, true, {}]) {
    const vehicle = toVehicle(record({ price }));
    assert.equal(vehicle?.price, null, `${String(price)} must normalise to null`);
  }
});

/* -------------------------------------------------------------------------
 * Slug: the URL, and therefore the canonical address
 * ---------------------------------------------------------------------- */

test("a slug is normalised into one safe path segment", () => {
  const cases: Array<[unknown, string]> = [
    ["toyota-land-cruiser", "toyota-land-cruiser"],
    ["Toyota Land Cruiser", "toyota-land-cruiser"],
    ["  TOYOTA--Land__Cruiser/  ", "toyota-land-cruiser"],
    ["BMW X5 (2024)", "bmw-x5-2024"],
  ];
  for (const [input, expected] of cases) {
    assert.equal(toVehicle(record({ slug: input }))?.slug, expected, String(input));
  }
});

test("a record with no usable slug is rejected, never given a derived one", () => {
  // types/vehicle.ts requires a stored slug: a derived one changes every link to
  // the vehicle when the make is corrected. Inventing one here would break the
  // guarantee the whole URL design rests on.
  for (const slug of [null, undefined, "", "   ", "---", "///"]) {
    assert.equal(toVehicle(record({ slug })), null, `${String(slug)} must be rejected`);
  }
});

/* -------------------------------------------------------------------------
 * Identification: what makes a vehicle a vehicle
 * ---------------------------------------------------------------------- */

test("a record with no make or no model is rejected", () => {
  for (const overrides of [{ make: null }, { make: "  " }, { model: null }, { model: "" }]) {
    assert.equal(toVehicle(record(overrides)), null, JSON.stringify(overrides));
  }
});

test("a record with no id is rejected", () => {
  assert.equal(toVehicle(record({ id: null })), null);
  assert.equal(toVehicle(record({ id: "" })), null);
});

test("a model year must be a plausible integer", () => {
  assert.equal(toVehicle(record({ year: 2024 }))?.year, 2024);
  // Not a year, a string, a float, a boilerplate date, or a car from the future.
  for (const year of ["2024", 1800, 2024.5, null, 2099]) {
    assert.equal(toVehicle(record({ year })), null, `${String(year)} must be rejected`);
  }
});

/* -------------------------------------------------------------------------
 * Availability: never guessed
 * ---------------------------------------------------------------------- */

test("availability is matched case-insensitively", () => {
  for (const [input, expected] of [
    ["available", "available"],
    ["AVAILABLE", "available"],
    ["Reserved", "reserved"],
    ["SOLD", "sold"],
  ] as const) {
    assert.equal(toVehicle(record({ status: input }))?.status, expected);
  }
});

test("an unknown availability rejects the vehicle instead of defaulting to available", () => {
  // Defaulting here would tell a customer a car is for sale on the strength of a
  // value this frontend did not understand. Inventing availability is the worst
  // thing this layer could do, so a new status surfaces as a bug instead.
  for (const status of ["sold_pending", "incoming", "", null, 1, true]) {
    assert.equal(toVehicle(record({ status })), null, `${String(status)} must be rejected`);
  }
});

/* -------------------------------------------------------------------------
 * Optional specifications: absent means absent
 * ---------------------------------------------------------------------- */

test("blank optional strings normalise to null rather than to an empty row", () => {
  const vehicle = toVehicle(
    record({ variant: "   ", body_type: "", transmission: "  ", location: "" }),
  );
  assert.ok(vehicle);
  assert.equal(vehicle.variant, null);
  assert.equal(vehicle.bodyType, null);
  assert.equal(vehicle.transmission, null);
  assert.equal(vehicle.location, null);
});

test("optional strings are trimmed", () => {
  const vehicle = toVehicle(record({ colour: "  Pearl White  " }));
  assert.equal(vehicle?.colour, "Pearl White");
});

test("a negative odometer reading is not a reading", () => {
  assert.equal(toVehicle(record({ mileage_km: -5 }))?.mileage, null);
});

test("a zero odometer reading is kept, because a new car genuinely reads zero", () => {
  // Deliberately asymmetric with the price rule. "$0" is never an asking price,
  // but "0 km" is a real reading, and suppressing it would hide a true fact.
  assert.equal(toVehicle(record({ mileage_km: 0 }))?.mileage, 0);
});

test("a VIN that does not conform to the standard is treated as not recorded", () => {
  assert.equal(toVehicle(record({ vin: "JTMBR05E904123456" }))?.vin, "JTMBR05E904123456");
  // Too short, too long, and the letters the standard excludes to avoid
  // confusion with 1 and 0.
  for (const vin of ["SHORT", "JTMBR05E9041234567", "QTMBM05E904123456", 12345, null]) {
    assert.equal(toVehicle(record({ vin }))?.vin, null, `${String(vin)} must be null`);
  }
});

/* -------------------------------------------------------------------------
 * Images
 * ---------------------------------------------------------------------- */

test("valid images are kept in order", () => {
  const vehicle = toVehicle(
    record({
      images: [
        { src: "/media/a.jpg", alt: "Front three-quarter view", width: 1200, height: 900 },
        { src: "https://cdn.example.com/b.jpg", alt: "Rear view", width: 1200, height: 900 },
      ],
    }),
  );
  assert.equal(vehicle?.images.length, 2);
  assert.equal(vehicle?.images[0].src, "/media/a.jpg");
  assert.equal(vehicle?.images[1].src, "https://cdn.example.com/b.jpg");
});

test("an image with no alt text is dropped rather than captioned from the vehicle name", () => {
  const vehicle = toVehicle(
    record({
      images: [
        { src: "/media/a.jpg", width: 1200, height: 900 },
        { src: "/media/b.jpg", alt: "", width: 1200, height: 900 },
        { src: "/media/c.jpg", alt: "   ", width: 1200, height: 900 },
      ],
    }),
  );
  assert.deepEqual(vehicle?.images, []);
});

test("an image source next/image cannot render is dropped", () => {
  const vehicle = toVehicle(
    record({
      images: [
        { src: "javascript:alert(1)", alt: "x", width: 10, height: 10 },
        { src: "data:image/svg+xml,<svg/>", alt: "x", width: 10, height: 10 },
        { src: "ftp://host/a.jpg", alt: "x", width: 10, height: 10 },
        { src: "", alt: "x", width: 10, height: 10 },
      ],
    }),
  );
  assert.deepEqual(vehicle?.images, []);
});

test("an image with unusable dimensions is dropped, so the box cannot collapse", () => {
  const vehicle = toVehicle(
    record({
      images: [
        { src: "/a.jpg", alt: "x", width: 0, height: 900 },
        { src: "/b.jpg", alt: "x", width: 1200, height: -1 },
        { src: "/c.jpg", alt: "x", width: "1200", height: "900" },
        { src: "/d.jpg", alt: "x" },
      ],
    }),
  );
  assert.deepEqual(vehicle?.images, []);
});

test("one unusable image does not cost the vehicle its usable ones", () => {
  const vehicle = toVehicle(
    record({
      images: [
        { src: "/good-1.jpg", alt: "Front view", width: 800, height: 600 },
        { src: "javascript:alert(1)", alt: "x", width: 800, height: 600 },
        { src: "/good-2.jpg", alt: "Rear view", width: 800, height: 600 },
      ],
    }),
  );
  assert.equal(vehicle?.images.length, 2);
  assert.equal(vehicle?.images[0].src, "/good-1.jpg");
  assert.equal(vehicle?.images[1].src, "/good-2.jpg");
});

test("images that are not a list are treated as no images, never as a crash", () => {
  for (const images of [null, undefined, "a.jpg", 42, { src: "/a.jpg" }]) {
    assert.deepEqual(toVehicle(record({ images }))?.images, [], String(images));
  }
});

/* -------------------------------------------------------------------------
 * Features
 * ---------------------------------------------------------------------- */

test("only string feature values are kept", () => {
  const vehicle = toVehicle(
    record({
      features: { Seats: "5", Bags: 3, Owners: "One", "": "ignored", Trim: "  " },
    }),
  );
  assert.deepEqual(vehicle?.features, { Seats: "5", Owners: "One" });
});

test("features that are not a flat object are treated as none", () => {
  for (const value of [null, undefined, "seats", 7, [1, 2]]) {
    assert.deepEqual(toVehicle(record({ features: value }))?.features, {}, String(value));
  }
});

/* -------------------------------------------------------------------------
 * The whole batch
 * ---------------------------------------------------------------------- */

test("one bad record costs one car, not the inventory", () => {
  const result = toVehicles([
    record({ id: "a", slug: "car-a" }),
    record({ id: "b", slug: "car-b", currency: "AED" }),
    record({ id: "c", slug: "car-c", status: "incoming" }),
    record({ id: "d", slug: "car-d" }),
  ]);

  assert.equal(result.vehicles.length, 2);
  assert.equal(result.rejected, 2);
  assert.deepEqual(
    result.vehicles.map((v) => v.slug),
    ["car-a", "car-d"],
  );
});

test("a batch that is not a list yields nothing and rejects nothing", () => {
  for (const input of [null, undefined, "cars", 7, {}]) {
    assert.deepEqual(toVehicles(input), { vehicles: [], rejected: 0 });
  }
});

test("non-objects are rejected individually rather than throwing", () => {
  for (const input of [null, undefined, "car", 42, true, [], ["car"]]) {
    assert.equal(toVehicle(input), null, JSON.stringify(input));
  }
});

test("source order is preserved", () => {
  const result = toVehicles([
    record({ slug: "c" }),
    record({ slug: "a" }),
    record({ slug: "b" }),
  ]);
  assert.deepEqual(
    result.vehicles.map((v) => v.slug),
    ["c", "a", "b"],
  );
});

/* -------------------------------------------------------------------------
 * The pagination envelope
 * ---------------------------------------------------------------------- */

test("a Page<T> envelope is unwrapped and its counts are preserved", () => {
  const page = toInventoryPage({
    items: [record({ slug: "a" }), record({ slug: "b" })],
    total: 57,
    page: 1,
    page_size: 2,
    total_pages: 29,
  });

  assert.equal(page.vehicles.length, 2);
  assert.equal(page.total, 57);
  assert.equal(page.page, 1);
  assert.equal(page.totalPages, 29);
  assert.equal(page.hasNextPage, true);
});

test("the last page reports no next page", () => {
  const page = toInventoryPage({
    items: [record()],
    total: 3,
    page: 2,
    page_size: 2,
    total_pages: 2,
  });
  assert.equal(page.hasNextPage, false);
});

test("a bare list is accepted, so an endpoint without the envelope still renders", () => {
  const page = toInventoryPage([record({ slug: "a" })]);
  assert.equal(page.vehicles.length, 1);
  assert.equal(page.total, 1);
  assert.equal(page.hasNextPage, false);
});

test("a malformed envelope degrades to an empty page rather than throwing", () => {
  for (const payload of [null, undefined, "nope", 7, { items: "nope" }, { total: "many" }]) {
    const page = toInventoryPage(payload);
    assert.deepEqual(page.vehicles, []);
    assert.equal(page.hasNextPage, false);
  }
});

test("a page whose total disagrees with its items is not trusted to hide vehicles", () => {
  // If the counts cannot be read, assume there may be more rather than fewer:
  // under-reporting would silently hide stock.
  const page = toInventoryPage({ items: [record()] });
  assert.equal(page.hasNextPage, false);
  assert.equal(page.total, 1);
});
