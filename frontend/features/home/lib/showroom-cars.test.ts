import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countByType,
  fromVehicles,
  PRICE_ON_REQUEST,
  toShowroomCars,
  type LegacyShowroomCar,
} from "./showroom-cars.ts";
import type { Vehicle } from "@/types/vehicle.ts";

/**
 * The showroom data mapping.
 *
 * This is the file that decides what a visitor reads about a car, so the cases
 * that matter are the awkward ones: a price that is really a button label, a
 * mileage that was never recorded, a car with no photograph. Every "accepts"
 * case below is the guard against the mapper starting to reject real inventory.
 */

function legacy(overrides: Partial<LegacyShowroomCar> = {}): LegacyShowroomCar {
  return {
    id: "car-1",
    title: "Toyota Land Cruiser Prado",
    subtitle: "hilux 0 mi 18/100 Automatic",
    mileage: "48,000 km",
    transmission: "Automatic",
    price: "185,000 USD",
    images: ["https://example.test/a.jpg", "https://example.test/b.jpg"],
    status: "new",
    ...overrides,
  };
}

function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "v-1",
    slug: "toyota-land-cruiser-prado",
    make: "Toyota",
    model: "Land Cruiser Prado",
    variant: null,
    year: 2022,
    bodyType: "SUV",
    transmission: "Automatic",
    fuel: "Diesel",
    colour: null,
    mileage: 48_000,
    vin: null,
    price: 185_000,
    currency: "USD",
    status: "available",
    images: [{ src: "https://example.test/a.jpg", alt: "Front three-quarter view", width: 1200, height: 800 }],
    features: [],
    ...overrides,
  } as Vehicle;
}

describe("toShowroomCars", () => {
  it("maps the fields the card needs", () => {
    const [car] = toShowroomCars([legacy()]);

    assert.equal(car.id, "car-1");
    assert.equal(car.name, "Toyota Land Cruiser Prado");
    assert.equal(car.type, "new");
    assert.equal(car.image, "https://example.test/a.jpg");
    assert.equal(car.specs, "48,000 km · Automatic");
    assert.equal(car.price, "185,000 USD");
    assert.equal(car.priceKnown, true);
  });

  it("reads the unpriced sentinels as an unknown price rather than a figure", () => {
    // The old data put the *button label* in the price slot, which is why the
    // section read as though a number were missing. Each spelling has appeared in
    // this data at some point, so all of them are matched.
    for (const sentinel of ["Request Price", "Price on request", "POA", "Ask", "on request"]) {
      const [car] = toShowroomCars([legacy({ price: sentinel })]);
      assert.equal(car.price, PRICE_ON_REQUEST, `${sentinel} should map to the unknown-price label`);
      assert.equal(car.priceKnown, false, `${sentinel} should not be treated as a price`);
    }
  });

  it("does not treat a real price as unpriced", () => {
    for (const price of ["185,000 USD", "$185,000", "POA 45,000", "Ask 45,000"]) {
      const [car] = toShowroomCars([legacy({ price })]);
      assert.equal(car.priceKnown, true, `${price} is a price and must be reported as known`);
    }
  });

  it("ignores the mangled subtitle and rebuilds the specs from real fields", () => {
    // The subtitle duplicated the model name and ran three facts together with no
    // separator. The specs line has to come from the structured fields instead, or
    // the run-on text is exactly what the visitor reads.
    const [car] = toShowroomCars([legacy({ subtitle: "hilux 0 mi 18/100 Automatic" })]);

    assert.ok(!car.specs.includes("hilux"), "the model name must not leak into the specs");
    assert.ok(!car.specs.includes("18/100"), "the stray rating must not leak into the specs");
    assert.equal(car.specs, "48,000 km · Automatic");
  });

  it("omits absent specs rather than leaving gaps in the line", () => {
    // A car with no transmission should read "48,000 km", not "48,000 km · " and
    // not "48,000 km · Unknown". Both look like a bug.
    const [car] = toShowroomCars([legacy({ transmission: "" })]);

    assert.equal(car.specs, "48,000 km");
    assert.ok(!car.specs.includes("·"), "an absent spec must not leave a dangling separator");
  });

  it("never yields an empty specs line of stray separators", () => {
    const [car] = toShowroomCars([legacy({ mileage: "", transmission: "" })]);

    assert.equal(car.specs, "");
  });

  it("treats a car with no photograph as normal rather than as an error", () => {
    const [car] = toShowroomCars([legacy({ images: [] })]);

    assert.equal(car.image, null, "no photograph is null, so the card can draw a placeholder");
  });

  it("takes only the first photograph", () => {
    // The card shows one image. A carousel was removed from this section; keeping
    // the rest of the array in the mapped shape would invite it back.
    const [car] = toShowroomCars([legacy()]);

    assert.equal(car.image, "https://example.test/a.jpg");
  });

  it("leaves href null for rows with no slug, so the card can skip the link", () => {
    // An anchor to nowhere is worse than a card that is not clickable, so the
    // mapper does not invent a destination.
    const [car] = toShowroomCars([legacy()]);

    assert.equal(car.href, null);
  });

  it("trims the name and the price", () => {
    const [car] = toShowroomCars([legacy({ title: "  Lexus LX 600  ", price: "  120,000 USD  " })]);

    assert.equal(car.name, "Lexus LX 600");
    assert.equal(car.price, "120,000 USD");
  });

  it("handles an empty list", () => {
    assert.deepEqual(toShowroomCars([]), []);
  });
});

describe("fromVehicles", () => {
  it("maps a real vehicle, reusing the project's formatters", () => {
    const [car] = fromVehicles([vehicle()], () => "new");

    assert.equal(car.name, "Toyota Land Cruiser Prado");
    assert.equal(car.specs, "2022 · Diesel · Automatic · 48,000 km");
    assert.equal(car.price, "$185,000");
    assert.equal(car.href, "/inventory/toyota-land-cruiser-prado");
    assert.equal(car.type, "new");
  });

  it("omits a mileage that was never recorded rather than claiming zero", () => {
    // `mileage: 0` is a real reading - a showroom car that has never been driven -
    // and `null` means nobody recorded it. Rendering "0 km" for the second case
    // would be a claim about the car that is not true.
    const [car] = fromVehicles([vehicle({ mileage: null })], () => "used");

    assert.ok(!car.specs.includes("0 km"), "an unrecorded mileage must not be shown as zero");
  });

  it("keeps a genuine zero mileage", () => {
    const [car] = fromVehicles([vehicle({ mileage: 0 })], () => "new");

    assert.ok(car.specs.includes("0 km"), "a real zero reading must survive");
  });

  it("reports an unpriced vehicle as unknown", () => {
    const [unpriced] = fromVehicles([vehicle({ price: null })], () => "new");
    assert.equal(unpriced.priceKnown, false);
    assert.equal(unpriced.price, PRICE_ON_REQUEST);

    // A zero from a badly populated column is not a price either, and
    // `formatVehiclePrice` already treats it that way.
    const [zero] = fromVehicles([vehicle({ price: 0 })], () => "new");
    assert.equal(zero.priceKnown, false);
  });

  it("never reports a sold car as having a known price", () => {
    const [car] = fromVehicles([vehicle({ status: "sold" })], () => "used");

    assert.equal(car.priceKnown, false);
  });

  it("omits absent specs without leaving gaps", () => {
    const [car] = fromVehicles(
      [vehicle({ fuel: null, transmission: null, mileage: null })],
      () => "new",
    );

    assert.equal(car.specs, "2022");
  });

  it("handles a vehicle with no photograph", () => {
    const [car] = fromVehicles([vehicle({ images: [] })], () => "new");

    assert.equal(car.image, null);
  });

  it("uses the caller's condition resolver, because the API has no condition field", () => {
    // `Vehicle.status` is availability, not new-vs-used. Deriving the tab from it
    // would file a brand-new car under "Used", so the resolver is required.
    const calls: string[] = [];
    fromVehicles([vehicle({ id: "a" }), vehicle({ id: "b" })], (v) => {
      calls.push(v.id);
      return v.id === "a" ? "new" : "used";
    });

    assert.deepEqual(calls, ["a", "b"], "every vehicle must be classified, not just the first");
  });
});

describe("countByType", () => {
  it("counts each tab", () => {
    const cars = toShowroomCars([
      legacy({ id: "1", status: "new" }),
      legacy({ id: "2", status: "new" }),
      legacy({ id: "3", status: "used" }),
    ]);

    assert.deepEqual(countByType(cars), { new: 2, used: 1 });
  });

  it("reports zero rather than omitting a tab with no cars", () => {
    // The tab still renders, so it still needs a count to show.
    assert.deepEqual(countByType([]), { new: 0, used: 0 });
  });
});
