import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildWhatsAppUrl,
  DEFAULT_WHATSAPP_MESSAGE,
  hasWhatsAppNumber,
  normaliseWhatsAppNumber,
} from "./whatsapp.ts";

/**
 * The contract under test: `buildWhatsAppUrl` returns `null` unless it is
 * certain the result dials a real number.
 *
 * Every "must be null" case below is a value that could plausibly reach the
 * environment variable by accident - a typo, a placeholder someone left in, a
 * spreadsheet artefact. A WhatsApp link that resolves to the wrong number is a
 * customer enquiry delivered to a stranger, and it is indistinguishable from
 * success, so the rejection cases matter more than the acceptance cases.
 */

describe("normaliseWhatsAppNumber", () => {
  it("accepts the formats a person would actually type", () => {
    const expected = "971501234567";
    for (const input of [
      "+971501234567",
      "971501234567",
      "+971 50 123 4567",
      "+971 (50) 123-4567",
      "+971-50-123-4567",
      "  +971501234567  ",
      "00971501234567",
    ]) {
      assert.equal(normaliseWhatsAppNumber(input), expected, `failed for ${input}`);
    }
  });

  it("rejects absent values", () => {
    for (const input of [undefined, null, "", "   "]) {
      assert.equal(normaliseWhatsAppNumber(input), null);
    }
  });

  it("rejects non-string input rather than coercing it", () => {
    // A number typed into the env var arrives as a string, but a config object
    // could hand over anything. Coercing would turn 971501234567 into a
    // plausible number from an unvalidated value.
    for (const input of [971501234567, true, {}, []]) {
      assert.equal(normaliseWhatsAppNumber(input as unknown as string), null);
    }
  });

  it("rejects anything containing a stray character", () => {
    // The important one: a trailing letter must fail rather than be stripped,
    // because stripping it would turn a typo into a real-looking number.
    for (const input of [
      "+971501234567x",
      "call +971501234567",
      "+971501234567 ext 4",
      "0501234567#3",
      "+971-501-234-567/89",
      "<script>",
    ]) {
      assert.equal(normaliseWhatsAppNumber(input), null, `should reject: ${input}`);
    }
  });

  it("rejects numbers outside the E.164 length bounds", () => {
    assert.equal(normaliseWhatsAppNumber("12345"), null, "too short");
    assert.equal(normaliseWhatsAppNumber("123456"), null, "still too short");
    assert.equal(normaliseWhatsAppNumber("1".repeat(16)), null, "too long");
    assert.equal(normaliseWhatsAppNumber("1".repeat(40)), null, "absurdly long");
  });

  it("accepts the exact boundary lengths", () => {
    assert.equal(normaliseWhatsAppNumber("1".repeat(7)), "1111111");
    assert.equal(normaliseWhatsAppNumber("1".repeat(15)), "1".repeat(15));
  });

  it("rejects a lone plus sign", () => {
    assert.equal(normaliseWhatsAppNumber("+"), null);
  });
});

describe("buildWhatsAppUrl", () => {
  it("returns null when no number is configured", () => {
    assert.equal(buildWhatsAppUrl(undefined), null);
    assert.equal(buildWhatsAppUrl(null), null);
    assert.equal(buildWhatsAppUrl(""), null);
  });

  it("returns null for an invalid number rather than guessing", () => {
    // The behaviours that must never ship.
    assert.equal(buildWhatsAppUrl("12345"), null);
    assert.equal(buildWhatsAppUrl("+971501234567x"), null);
    assert.equal(buildWhatsAppUrl("+971 (50) 123-4567 ext 9"), null);
  });

  it("builds a canonical wa.me URL from a valid number", () => {
    assert.equal(
      buildWhatsAppUrl("+971 50 123 4567"),
      "https://wa.me/971501234567",
    );
  });

  it("omits the query string entirely when there is no message", () => {
    // Not `?text=` with an empty value, which some clients render literally.
    assert.equal(buildWhatsAppUrl("+971501234567"), "https://wa.me/971501234567");
  });

  it("encodes a message", () => {
    const url = buildWhatsAppUrl("+971501234567", "Hello & welcome");
    assert.equal(url, "https://wa.me/971501234567?text=Hello%20%26%20welcome");
  });

  it("encodes characters that would otherwise break the URL", () => {
    const url = buildWhatsAppUrl(
      "+971501234567",
      "2019 Range Rover Sport #3 — diesel?",
    );
    assert.ok(url);
    const query = url.slice(url.indexOf("?text=") + "?text=".length);
    // Round-trips exactly, and contains no raw structural characters.
    assert.equal(decodeURIComponent(query), "2019 Range Rover Sport #3 — diesel?");
    assert.ok(!/[&#?]/.test(query), "query must not contain unescaped URL structure");
  });

  it("trims a message and treats a whitespace-only message as absent", () => {
    assert.equal(
      buildWhatsAppUrl("+971501234567", "  hello  "),
      "https://wa.me/971501234567?text=hello",
    );
    assert.equal(buildWhatsAppUrl("+971501234567", "   "), "https://wa.me/971501234567");
  });

  it("uses https, never a bare or http origin", () => {
    const url = buildWhatsAppUrl("+971501234567");
    assert.ok(url?.startsWith("https://"), "must be https");
    assert.ok(!url?.startsWith("//"), "must not be protocol-relative");
  });

  it("carries the default message through the same encoding path", () => {
    const url = buildWhatsAppUrl("+971501234567", DEFAULT_WHATSAPP_MESSAGE);
    assert.ok(url);
    const query = url.slice(url.indexOf("?text=") + "?text=".length);
    assert.equal(decodeURIComponent(query), DEFAULT_WHATSAPP_MESSAGE);
  });

  it("makes no claim about stock or pricing in the default message", () => {
    // The same default is used on the homepage, on listings and on export pages,
    // so it must not assert anything that could be untrue anywhere.
    const message = DEFAULT_WHATSAPP_MESSAGE.toLowerCase();
    for (const claim of ["available", "in stock", "cheapest", "guarantee", "discount"]) {
      assert.ok(!message.includes(claim), `default message should not claim "${claim}"`);
    }
  });
});

describe("hasWhatsAppNumber", () => {
  it("agrees with normaliseWhatsAppNumber", () => {
    assert.equal(hasWhatsAppNumber("+971501234567"), true);
    assert.equal(hasWhatsAppNumber("12345"), false);
    assert.equal(hasWhatsAppNumber(undefined), false);
  });
});
