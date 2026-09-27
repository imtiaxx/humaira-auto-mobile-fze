import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  imageProblemMessage,
  parseImagePosition,
  parseImageProblem,
  type ImageUploadProblem,
} from "./image-upload-feedback.ts";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_FILES_PER_UPLOAD,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_VEHICLE,
} from "./image-limits.ts";

/**
 * The upload outcome travels in a query string, so these parsers are the boundary
 * between an attacker-editable URL and a sentence rendered to a staff member. The
 * tests below are mostly about what they *refuse*.
 *
 * Relative `.ts` specifiers, because `node --test` runs this file directly and does
 * not read `tsconfig.json`'s path aliases.
 */
describe("parseImageProblem", () => {
  it("accepts every code in the union", () => {
    const codes: ImageUploadProblem[] = [
      "no_files",
      "too_many_files",
      "too_many_images",
      "missing_alt",
      "unreadable_upload",
      "not_a_vehicle_image",
      "too_large",
      "vehicle_not_found",
      "session_expired",
      "failed",
    ];

    for (const code of codes) {
      assert.equal(parseImageProblem(code), code);
    }
  });

  it("treats an absent parameter as no problem at all", () => {
    assert.equal(parseImageProblem(null), null);
    assert.equal(parseImageProblem(undefined), null);
    assert.equal(parseImageProblem(""), null);
  });

  it("refuses an unrecognised value rather than passing it through", () => {
    // The reason this function exists. A code that is not in the union must not
    // reach `imageProblemMessage`, whose `switch` has no `default` and would
    // return `undefined` for it - rendering "undefined" in a red banner.
    assert.equal(parseImageProblem("something_else"), null);
    assert.equal(parseImageProblem("<script>alert(1)</script>"), null);
    assert.equal(parseImageProblem("NO_FILES"), null);
  });
});

describe("parseImagePosition", () => {
  it("accepts a one-based position within the upload cap", () => {
    assert.equal(parseImagePosition("1"), 1);
    assert.equal(parseImagePosition("3"), 3);
    assert.equal(parseImagePosition(String(MAX_FILES_PER_UPLOAD)), MAX_FILES_PER_UPLOAD);
  });

  it("refuses zero, negatives and non-integers", () => {
    // Zero and negatives are off-by-one accidents; the reader counts from one.
    assert.equal(parseImagePosition("0"), null);
    assert.equal(parseImagePosition("-1"), null);
    assert.equal(parseImagePosition("1.5"), null);
  });

  it("refuses a position past the cap", () => {
    // Otherwise a hand-edited URL produces "Photograph 2147483647 needs a
    // description", which is both absurd and a denial of the staff member's time.
    assert.equal(parseImagePosition(String(MAX_FILES_PER_UPLOAD + 1)), null);
    assert.equal(parseImagePosition("2147483647"), null);
  });

  it("refuses non-numeric text", () => {
    assert.equal(parseImagePosition("first"), null);
    assert.equal(parseImagePosition("1e3"), null);
    // `Number("")` is 0, and `Number(" ")` is 0 too - both must not become a
    // position, which is why the empty case is checked before the parse.
    assert.equal(parseImagePosition(""), null);
    assert.equal(parseImagePosition(" "), null);
  });

  it("treats an absent parameter as no position", () => {
    assert.equal(parseImagePosition(null), null);
    assert.equal(parseImagePosition(undefined), null);
  });
});

describe("imageProblemMessage", () => {
  it("returns a sentence for every code, with no `default` branch", () => {
    // Exhaustiveness is compile-time, but a code that produced an empty string
    // would still be a blank banner in front of a staff member. So: every code
    // yields something non-empty.
    const codes: ImageUploadProblem[] = [
      "no_files",
      "too_many_files",
      "too_many_images",
      "missing_alt",
      "unreadable_upload",
      "not_a_vehicle_image",
      "too_large",
      "vehicle_not_found",
      "session_expired",
      "failed",
    ];

    for (const code of codes) {
      const message = imageProblemMessage(code, null);
      assert.ok(message.length > 0, `${code} produced an empty message`);
    }
  });

  it("names the photograph when a position is supplied", () => {
    assert.match(imageProblemMessage("missing_alt", 2), /Photograph 2/);
  });

  it("stays true without a position, rather than naming a missing one", () => {
    const message = imageProblemMessage("missing_alt", null);
    assert.ok(!message.includes("null"));
    assert.ok(!message.includes("undefined"));
  });

  it("quotes the real limits, not remembered ones", () => {
    // The messages are built from the same constants the checks use, so the number
    // a staff member reads and the number that is enforced cannot disagree.
    assert.match(
      imageProblemMessage("too_many_files", null),
      new RegExp(String(MAX_FILES_PER_UPLOAD)),
    );
    assert.match(
      imageProblemMessage("too_many_images", null),
      new RegExp(String(MAX_IMAGES_PER_VEHICLE)),
    );
    assert.match(
      imageProblemMessage("too_large", null),
      new RegExp(String(MAX_IMAGE_BYTES / (1024 * 1024))),
    );
  });

  it("tells the staff member the alt text cannot be guessed", () => {
    // The sentence that justifies the extra field. If this is ever shortened to
    // "alt text is required", the reason for the requirement goes with it.
    assert.match(imageProblemMessage("missing_alt", 1), /screen reader/);
  });
});

describe("image limits", () => {
  it("matches the backend's configured defaults", () => {
    // Mirrors `image_max_files_per_request`, `image_max_per_vehicle` and
    // `image_max_bytes` in `backend/app/core/config.py`. If one of those changes,
    // this fails and the number here should change with it.
    assert.equal(MAX_FILES_PER_UPLOAD, 10);
    assert.equal(MAX_IMAGES_PER_VEHICLE, 30);
    assert.equal(MAX_IMAGE_BYTES, 10 * 1024 * 1024);
  });

  it("only accepts the three formats the backend decodes", () => {
    // Notably not `image/heic`, which is what a phone camera actually produces.
    assert.deepEqual([...ACCEPTED_IMAGE_TYPES], ["image/jpeg", "image/png", "image/webp"]);
  });

  it("never lets one request exceed the per-vehicle cap", () => {
    // A gallery can be filled several uploads at a time, so the two limits have to
    // be consistent: a full vehicle must be reachable by adding a legal amount.
    assert.ok(MAX_FILES_PER_UPLOAD <= MAX_IMAGES_PER_VEHICLE);
  });
});
