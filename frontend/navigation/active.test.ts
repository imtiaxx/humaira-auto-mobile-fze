import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasActiveItem, isActiveRoute } from "./active.ts";

/**
 * Active-route matching.
 *
 * These cases are the ones that produce visibly wrong navigation. A header that
 * lights up "Home" on every page, or that lights up "Sell / Source" while the
 * visitor is on `/sell-your-car`, looks broken rather than merely off, and it is
 * the kind of bug that survives review because nobody happens to be on that
 * exact page during the demo.
 */

describe("isActiveRoute", () => {
  it("matches the root only on the root", () => {
    // The classic bug: `startsWith("/")` is true for every path, so Home shows
    // as active everywhere.
    assert.equal(isActiveRoute("/", "/"), true);
    assert.equal(isActiveRoute("/inventory", "/"), false);
    assert.equal(isActiveRoute("/system-status", "/"), false);
  });

  it("matches an exact path", () => {
    assert.equal(isActiveRoute("/export", "/export"), true);
    assert.equal(isActiveRoute("/brands", "/brands"), true);
  });

  it("matches nested routes under a section", () => {
    assert.equal(isActiveRoute("/export/shipping", "/export"), true);
    assert.equal(isActiveRoute("/export/documentation", "/export"), true);
    assert.equal(isActiveRoute("/export/a/b/c", "/export"), true);
  });

  it("does not match a sibling that merely shares a prefix", () => {
    // The second classic bug: a naive `startsWith` marks "Compare Cars" active
    // on `/compare-cars` and "Sell / Source" active on `/sell-your-car`.
    assert.equal(isActiveRoute("/exporting", "/export"), false);
    assert.equal(isActiveRoute("/compare-cars", "/compare"), false);
    assert.equal(isActiveRoute("/sell-your-car", "/sell"), false);
    assert.equal(isActiveRoute("/brands-archive", "/brands"), false);
  });

  it("does not mark unrelated pages active", () => {
    assert.equal(isActiveRoute("/inventory", "/contact"), false);
    assert.equal(isActiveRoute("/about", "/export"), false);
  });

  it("ignores a trailing slash on either side", () => {
    // A trailing slash is the same route, not a different one.
    assert.equal(isActiveRoute("/export/", "/export"), true);
    assert.equal(isActiveRoute("/export", "/export/"), true);
    assert.equal(isActiveRoute("/export/shipping/", "/export"), true);
    assert.equal(isActiveRoute("/", "/"), true);
  });

  it("still refuses a prefix match on a sibling with a trailing slash", () => {
    assert.equal(isActiveRoute("/exporting/", "/export"), false);
  });

  it("treats the site root as not matching a nested path", () => {
    // Belt and braces: even if the root check were removed, "/" must not act as
    // a section prefix.
    assert.equal(isActiveRoute("/anything", "/"), false);
  });
});

describe("hasActiveItem", () => {
  it("is true when any href matches", () => {
    assert.equal(hasActiveItem("/export/shipping", ["/", "/export", "/about"]), true);
  });

  it("is false when nothing matches", () => {
    assert.equal(hasActiveItem("/contact", ["/", "/export", "/about"]), false);
  });

  it("is false for an empty list", () => {
    assert.equal(hasActiveItem("/anything", []), false);
  });
});
