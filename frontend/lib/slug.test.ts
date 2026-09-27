/**
 * The shared slug rule, pinned.
 *
 * Two features depend on this function agreeing exactly - the public normaliser
 * and the staff editor - so the cases that matter are the ones where the two
 * could plausibly disagree: what gets folded, what gets dropped, and what counts
 * as "nothing usable was typed".
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { normaliseSlug } from "./slug.ts";

test("lower-cases and folds separators to hyphens", () => {
  assert.equal(normaliseSlug("Land Rover Defender"), "land-rover-defender");
  assert.equal(normaliseSlug("land_rover/defender"), "land-rover-defender");
  assert.equal(normaliseSlug("LAND   ROVER"), "land-rover");
});

test("drops characters that would need percent-encoding", () => {
  assert.equal(normaliseSlug("Range Rover (2021)"), "range-rover-2021");
  assert.equal(normaliseSlug("BMW M3?"), "bmw-m3");
  assert.equal(normaliseSlug("café"), "caf");
});

test("collapses repeated hyphens and trims them from the ends", () => {
  assert.equal(normaliseSlug("--a---b--"), "a-b");
  assert.equal(normaliseSlug("  /a/b/  "), "a-b");
});

test("keeps digits, which are valid in a slug", () => {
  assert.equal(normaliseSlug("Model S 2019"), "model-s-2019");
});

test("returns null when there is nothing usable", () => {
  // The distinction that matters to the callers: an empty field is a missing
  // value, and a field of only unusable characters is a present value that
  // cannot be used. Merging them would tell a staff member a field they did fill
  // in was "required".
  assert.equal(normaliseSlug(""), null);
  assert.equal(normaliseSlug("   "), null);
  assert.equal(normaliseSlug("!!!"), null);
  assert.equal(normaliseSlug("---"), null);
});

test("returns null for values that are not strings", () => {
  // The input is `unknown` because it arrives from JSON, where a slug can be
  // null or a number.
  assert.equal(normaliseSlug(null), null);
  assert.equal(normaliseSlug(undefined), null);
  assert.equal(normaliseSlug(42), null);
});

test("is idempotent, so normalising twice changes nothing", () => {
  // This is what lets the editor normalise a stored slug on the way out without
  // the possibility of a value that changes on every save.
  const once = normaliseSlug("Range Rover (2021)");
  assert.equal(normaliseSlug(once), once);
});
