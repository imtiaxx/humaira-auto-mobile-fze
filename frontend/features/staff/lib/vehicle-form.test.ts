/**
 * The vehicle form parser, pinned.
 *
 * ---------------------------------------------------------------------------
 * What these tests are for
 * ---------------------------------------------------------------------------
 * `vehicle-form.ts` is the only thing between what a staff member typed and a
 * request the backend will accept. Its rules exist so that a mistake is reported
 * as a message on the right field, rather than as a `422` whose field path means
 * nothing to the person who has to fix it.
 *
 * The two behaviours most worth pinning are the ones that would lose data:
 *
 * - A failed parse returns **every** submitted value, so the form can be
 *   re-rendered filled in. A form that clears a carefully typed description
 *   because one field was blank is its own kind of data loss.
 * - Optional fields the staff member cleared become `null`, and only then. There
 *   is no code path that turns a typed value into a default.
 *
 * ---------------------------------------------------------------------------
 * The inputs below are validator test data, not inventory
 * ---------------------------------------------------------------------------
 * The same convention as `features/vehicles/lib/vehicle-schema.test.ts`: nothing
 * in this file is imported by the application, and no vehicle reaches a page from
 * it. The makes and models are realistic so a failing assertion reads like the
 * case it is about.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AVAILABILITY_OPTIONS,
  emptyVehicleFormValues,
  parseVehicleForm,
  suggestSlug,
  vehicleFormValues,
} from "./vehicle-form.ts";

/** Builds `FormData` the way a real submit would, with overrides applied. */
function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const base: Record<string, string> = {
    slug: "range-rover-sport",
    make: "Land Rover",
    model: "Range Rover Sport",
    variant: "Autobiography",
    year: "2022",
    body_type: "SUV",
    transmission: "Automatic",
    fuel: "Petrol",
    colour: "Black",
    mileage_km: "24000",
    vin: "SALYB2EX4MA123456",
    price: "84500",
    status: "available",
    location: "Dubai",
  };

  for (const [key, value] of Object.entries({ ...base, ...overrides })) {
    data.set(key, value);
  }
  return data;
}

/** Adds feature rows in the paired field names the parser reads. */
function withFeatures(data: FormData, rows: Array<{ name: string; value: string }>): FormData {
  rows.forEach((row) => {
    data.append("feature_name", row.name);
    data.append("feature_value", row.value);
  });
  return data;
}

test("a complete, valid form produces a full request body", () => {
  const result = parseVehicleForm(form());

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.body.slug, "range-rover-sport");
  assert.equal(result.body.make, "Land Rover");
  assert.equal(result.body.model, "Range Rover Sport");
  assert.equal(result.body.year, 2022);
  assert.equal(result.body.mileage_km, 24000);
  assert.equal(result.body.price, 84500);
  // Sent as a constant, never read from the form. The form does not render a
  // currency control, because a dropdown offering one option is a lie about
  // choice.
  assert.equal(result.body.currency, "USD");
  assert.equal(result.body.status, "available");
  assert.equal(result.body.features, null);
});

test("cleared optional fields become null, not empty strings", () => {
  const result = parseVehicleForm(
    form({ variant: "", body_type: "", transmission: "", fuel: "", colour: "", location: "" }),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;

  // The backend collapses blank strings to null anyway, but sending null means
  // what it means, and an empty string is a value the schema has to interpret.
  assert.equal(result.body.variant, null);
  assert.equal(result.body.body_type, null);
  assert.equal(result.body.transmission, null);
  assert.equal(result.body.fuel, null);
  assert.equal(result.body.colour, null);
  assert.equal(result.body.location, null);
});

test("whitespace-only optional fields count as cleared", () => {
  const result = parseVehicleForm(form({ colour: "   ", location: " " }));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.body.colour, null);
  assert.equal(result.body.location, null);
});

test("a failed parse returns every submitted value so the form can be refilled", () => {
  // The behaviour this whole function exists to protect: a staff member who
  // filled in twenty fields must not lose nineteen of them to one blank.
  const data = form({ year: "", mileage_km: "12345", colour: "Green" });
  const result = parseVehicleForm(data);

  assert.equal(result.ok, false);
  if (result.ok) return;

  assert.ok(result.errors.year, "the missing year is reported");
  assert.equal(result.values.mileage_km, "12345");
  assert.equal(result.values.colour, "Green");
  assert.equal(result.values.model, "Range Rover Sport");
});

test("required fields are required, and the message names the field", () => {
  for (const field of ["make", "model", "slug"]) {
    const result = parseVehicleForm(form({ [field]: "" }));
    assert.equal(result.ok, false, `${field} is required`);
    if (result.ok) continue;
    assert.ok(result.errors[field], `${field} has its own message`);
  }
});

test("an unknown availability state is refused, never defaulted", () => {
  const result = parseVehicleForm(form({ status: "sold_pending" }));

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.status);
});

test("all three availability states are accepted", () => {
  for (const option of AVAILABILITY_OPTIONS) {
    const result = parseVehicleForm(form({ status: option.value }));
    assert.equal(result.ok, true, `${option.value} is accepted`);
    if (!result.ok) continue;
    assert.equal(result.body.status, option.value);
  }
});

test("a zero price is an error, not a request for price on request", () => {
  // The backend rejects 0 too. A form that quietly turned a typed 0 into "price
  // on request" would be hiding a mistake, and the two are very different things
  // to a sales team.
  const result = parseVehicleForm(form({ price: "0" }));

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.price);
});

test("a price is refused when it carries more than two decimal places", () => {
  const result = parseVehicleForm(form({ price: "100.005" }));
  assert.equal(result.ok, false);
});

test("a blank price is price on request, and is accepted", () => {
  const result = parseVehicleForm(form({ price: "" }));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.body.price, null);
});

test("a negative mileage is refused rather than stored", () => {
  const result = parseVehicleForm(form({ mileage_km: "-5" }));
  assert.equal(result.ok, false);
});

test("a fractional mileage is refused", () => {
  const result = parseVehicleForm(form({ mileage_km: "100.5" }));
  assert.equal(result.ok, false);
});

test("an implausible model year is refused at both ends of the range", () => {
  for (const year of ["1899", String(new Date().getFullYear() + 2)]) {
    const result = parseVehicleForm(form({ year }));
    assert.equal(result.ok, false, `${year} is refused`);
  }
});

test("a VIN of the wrong length is refused", () => {
  const result = parseVehicleForm(form({ vin: "TOOSHORT" }));
  assert.equal(result.ok, false);
});

test("a VIN containing I, O or Q is refused", () => {
  // Those three are excluded by the standard because they are confusable with 1
  // and 0 in a hand-transcribed value, so a "VIN" containing one is a misreading.
  const result = parseVehicleForm(form({ vin: "SALYB2EX4MA12345I" }));
  assert.equal(result.ok, false);
});

test("a valid VIN is upper-cased on the way out", () => {
  const result = parseVehicleForm(form({ vin: "salyb2ex4ma123456" }));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  // Upper-cased because that is how the backend stores it, and a lowercase value
  // on screen and an uppercase one in the database is a confusing difference to
  // find later.
  assert.equal(result.body.vin, "SALYB2EX4MA123456");
});

test("a typed slug is normalised, and a slug with no usable characters says so", () => {
  const messy = parseVehicleForm(form({ slug: "Range Rover Sport (2022)" }));
  assert.equal(messy.ok, true);
  if (messy.ok) assert.equal(messy.body.slug, "range-rover-sport-2022");

  // A different message from a missing slug: the staff member did type something.
  const unusable = parseVehicleForm(form({ slug: "!!!" }));
  assert.equal(unusable.ok, false);
  if (unusable.ok) return;
  assert.ok(unusable.errors.slug);
  assert.ok(!unusable.errors.slug?.includes("required"));
});

test("features round-trip as ordered pairs", () => {
  const result = parseVehicleForm(
    withFeatures(form(), [
      { name: "Tow bar", value: "Factory fitted" },
      { name: "Panoramic roof", value: "Yes" },
    ]),
  );

  assert.equal(result.ok, true);
  if (!result.ok) return;
  // Insertion order preserved, because a JSON object cannot represent a
  // duplicate label and the form needs somewhere to put the rows back.
  assert.deepEqual(result.body.features, {
    "Tow bar": "Factory fitted",
    "Panoramic roof": "Yes",
  });
});

test("a half-filled feature row is an error rather than something to skip", () => {
  // Silently dropping the row looks like a save that lost data, which is exactly
  // why the backend's `_clean_features` rejects rather than filters.
  const noValue = parseVehicleForm(withFeatures(form(), [{ name: "Tow bar", value: "" }]));
  assert.equal(noValue.ok, false);

  const noName = parseVehicleForm(withFeatures(form(), [{ name: "", value: "Factory" }]));
  assert.equal(noName.ok, false);
});

test("two features with the same name are refused", () => {
  // A JSON object cannot hold both, so accepting them would silently drop one on
  // the way to the database.
  const result = parseVehicleForm(
    withFeatures(form(), [
      { name: "Tow bar", value: "Factory" },
      { name: "Tow bar", value: "Aftermarket" },
    ]),
  );

  assert.equal(result.ok, false);
});

test("a completely empty feature row is ignored, not reported", () => {
  // The row exists only because the "add feature" button was clicked and then
  // abandoned. That is a normal thing to do and must not block a save.
  const result = parseVehicleForm(withFeatures(form(), [{ name: "", value: "" }]));

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.body.features, null);
});

test("all reported errors are returned at once, not one per attempt", () => {
  const result = parseVehicleForm(form({ make: "", model: "", year: "", price: "0" }));

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.make);
  assert.ok(result.errors.model);
  assert.ok(result.errors.year);
  assert.ok(result.errors.price);
});

test("the blank form defaults to the current year and 'available'", () => {
  const values = emptyVehicleFormValues();

  assert.equal(values.year, String(new Date().getFullYear()));
  assert.equal(values.status, "available");
  assert.deepEqual(values.featureRows, []);
  // Nothing else is prefilled. A default body type or colour would be a claim
  // about the vehicle that nobody made.
  assert.equal(values.make, "");
  assert.equal(values.colour, "");
});

test("the edit form is prefilled from the vehicle, with nulls becoming blanks", () => {
  const values = vehicleFormValues({
    slug: "range-rover-sport",
    make: "Land Rover",
    model: "Range Rover Sport",
    variant: null,
    year: 2022,
    bodyType: "SUV",
    transmission: null,
    fuel: null,
    colour: "Black",
    mileageKm: 24000,
    vin: null,
    price: null,
    status: "reserved",
    location: "Dubai",
    features: [{ name: "Tow bar", value: "Factory fitted" }],
  });

  // `null` becomes "" so the input renders empty rather than as the text "null",
  // and so clearing and saving round-trips back to the same absence.
  assert.equal(values.variant, "");
  assert.equal(values.transmission, "");
  assert.equal(values.vin, "");
  assert.equal(values.price, "");
  assert.equal(values.mileage_km, "24000");
  assert.equal(values.status, "reserved");
  assert.deepEqual(values.featureRows, [{ name: "Tow bar", value: "Factory fitted" }]);
});

test("a suggested slug is derived from make, model and variant", () => {
  assert.equal(
    suggestSlug({ make: "Land Rover", model: "Range Rover Sport", variant: "Autobiography" }),
    "land-rover-range-rover-sport-autobiography",
  );
});

test("a suggestion ignores an absent variant rather than emitting a stray hyphen", () => {
  assert.equal(suggestSlug({ make: "BMW", model: "M3", variant: null }), "bmw-m3");
  // Idempotent, so a staff member can accept the suggestion and save repeatedly
  // without the slug growing a new suffix each time.
  assert.equal(suggestSlug({ make: "BMW", model: "M3" }), "bmw-m3");
});
