import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatMileage,
  formatVehiclePrice,
  hasQuotedPrice,
  vehiclePath,
  vehicleTitle,
  vehicleTitleWithYear,
} from "./format.ts";
import type { Vehicle } from "../../../types/vehicle.ts";

/**
 * The pricing rules, pinned.
 *
 * USD formatting and the absence rules are the two things on a vehicle page that
 * are expensive to get wrong and cheap to test, because a wrong price or a
 * fabricated "$0" is visible to every customer on the page. These assertions
 * exist so that a later change to the formatter cannot quietly alter what a
 * customer is told.
 *
 * ---------------------------------------------------------------------------
 * These objects are unit-test values, not inventory
 * ---------------------------------------------------------------------------
 * A formatter cannot be tested without a value to format, so this file builds
 * `Vehicle` objects. They are confined to this test file, which nothing in the
 * application imports and which is not part of the production bundle.
 *
 * They are not listings and are never rendered. `listVehicles()` returns an empty
 * array, so the site shows no vehicles, and these values cannot reach a page: the
 * only way a vehicle gets rendered is through `listVehicles()`, and no
 * `listVehicles` here refers to this file. The make and model are used only
 * because a test asserting "$35,000" needs *some* vehicle, and because a real
 * name is easier to read in a failing assertion than "Test Make".
 *
 * `currency` is typed `"USD"`, so a fixture asserting any other currency would be
 * a type error rather than a test failure - which is the intended design.
 */
function vehicleWith(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "veh_test_1",
    slug: "toyota-land-cruiser",
    make: "Toyota",
    model: "Land Cruiser",
    variant: null,
    year: 2024,
    bodyType: null,
    transmission: null,
    fuel: null,
    colour: null,
    mileage: null,
    vin: null,
    price: null,
    currency: "USD",
    status: "available",
    location: null,
    images: [],
    features: {},
    ...overrides,
  };
}

test("a real price renders in USD with a bare dollar sign", () => {
  assert.equal(formatVehiclePrice(vehicleWith({ price: 35000 })), "$35,000");
});

test("a price is grouped, has no decimals and is never abbreviated", () => {
  assert.equal(formatVehiclePrice(vehicleWith({ price: 1234567 })), "$1,234,567");
});

test("a null price asks for the price instead of rendering a number", () => {
  assert.equal(
    formatVehiclePrice(vehicleWith({ price: null })),
    "Price on request",
  );
});

test("a zero price is treated as no price, never rendered as $0", () => {
  assert.equal(formatVehiclePrice(vehicleWith({ price: 0 })), "Price on request");
});

test("a negative price is treated as no price, not rendered as -$1", () => {
  assert.equal(formatVehiclePrice(vehicleWith({ price: -5000 })), "Price on request");
});

test("the lowest real price is not mistaken for absence", () => {
  assert.equal(formatVehiclePrice(vehicleWith({ price: 1 })), "$1");
});

test("a sold vehicle says Sold rather than quoting a figure", () => {
  assert.equal(
    formatVehiclePrice(vehicleWith({ price: 35000, status: "sold" })),
    "Sold",
  );
});

test("a sold vehicle with no price does not fall back to Price on request", () => {
  assert.equal(
    formatVehiclePrice(vehicleWith({ price: null, status: "sold" })),
    "Sold",
  );
});

test("a reserved vehicle still quotes its price", () => {
  assert.equal(
    formatVehiclePrice(vehicleWith({ price: 35000, status: "reserved" })),
    "$35,000",
  );
});

test("mileage is grouped in kilometres", () => {
  assert.equal(formatMileage(45000), "45,000 km");
  assert.equal(formatMileage(0), "0 km");
});

test("the title is make and model, without the variant", () => {
  const vehicle = vehicleWith({ variant: "L Limited" });
  assert.equal(vehicleTitle(vehicle), "Toyota Land Cruiser");
});

test("the year-prefixed title leads with the year", () => {
  assert.equal(
    vehicleTitleWithYear(vehicleWith({ variant: "L Limited" })),
    "2024 Toyota Land Cruiser",
  );
});

test("a vehicle has exactly one address, under /inventory", () => {
  assert.equal(
    vehiclePath("toyota-land-cruiser"),
    "/inventory/toyota-land-cruiser",
  );
});

/*
 * Regression: the page metadata interpolated the formatter's output straight into
 * a sentence, so a sold car with a price produced the meta description
 * "Listed at Sold." in the description, `og:description` and `twitter:description`.
 * `hasQuotedPrice` is the guard that prevents it recurring at a second call site.
 */
test("a sold vehicle never claims a price, so no sentence can quote one", () => {
  assert.equal(hasQuotedPrice(vehicleWith({ price: 35000, status: "sold" })), false);
});

test("an unpriced vehicle never claims a price either", () => {
  assert.equal(hasQuotedPrice(vehicleWith({ price: null })), false);
});

test("an available priced vehicle does claim one", () => {
  assert.equal(hasQuotedPrice(vehicleWith({ price: 35000 })), true);
});

test("a reserved priced vehicle still claims one", () => {
  assert.equal(
    hasQuotedPrice(vehicleWith({ price: 35000, status: "reserved" })),
    true,
  );
});

/*
 * `hasQuotedPrice` has to agree with `formatVehiclePrice` exactly. If it claimed
 * a price the formatter declined to render, the description would read
 * "Listed at Price on request" - the same class of bug as "Listed at Sold.", one
 * layer up and therefore not covered by the tests above.
 */
test("a zero price cannot be quoted into a sentence", () => {
  assert.equal(hasQuotedPrice(vehicleWith({ price: 0 })), false);
});

test("a negative price cannot be quoted into a sentence", () => {
  assert.equal(hasQuotedPrice(vehicleWith({ price: -5000 })), false);
});

test("the two price rules agree for every status and price combination", () => {
  const statuses = ["available", "reserved", "sold"] as const;
  const prices = [null, 0, -1, 1, 35000];

  for (const status of statuses) {
    for (const price of prices) {
      const vehicle = vehicleWith({ status, price });
      const rendered = formatVehiclePrice(vehicle);
      const quoted = hasQuotedPrice(vehicle);

      // If a real figure is quoted into a sentence, the rendered value must be
      // that figure. If it is not quoted, the value must be a phrase.
      if (quoted) {
        assert.notEqual(
          rendered,
          "Price on request",
          `${status}/${price}: quoted a price but rendered a phrase`,
        );
        assert.notEqual(
          rendered,
          "Sold",
          `${status}/${price}: quoted a price but rendered a phrase`,
        );
      } else {
        assert.ok(
          rendered === "Price on request" || rendered === "Sold",
          `${status}/${price}: declined to quote but rendered "${rendered}"`,
        );
      }
    }
  }
});
