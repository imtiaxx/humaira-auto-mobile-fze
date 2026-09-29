import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseEnquiry, parseEnquiryPage } from "./enquiry-schema.ts";

/**
 * The staff enquiry data boundary.
 *
 * ---------------------------------------------------------------------------
 * The one property these tests exist to protect
 * ---------------------------------------------------------------------------
 * `status` arrives from the API as `string` - `apiGet` returns a type assertion,
 * which is erased at runtime, so nothing stops the transport from putting
 * `"responded"` in a field this admin believes holds three values. Every
 * `status` case below is about that.
 *
 * It matters more than it might look. The staff list filters by status, so a
 * record whose status is outside the enum would be rendered, then be invisible
 * under every filter including "All" is fine but "Pending" is not - and a member
 * of staff would draw the reasonable conclusion that enquiries had been lost.
 *
 * ---------------------------------------------------------------------------
 * Why dropping is tested as loudly as rejecting
 * ---------------------------------------------------------------------------
 * `parseEnquiryPage` drops a row it cannot read and reports `skipped`, so the
 * page can say how many. The alternative - dropping silently - is the failure
 * this count exists to prevent, and it would be invisible in exactly the
 * situation where it matters.
 *
 * Relative `.ts` specifiers, because `node --test` runs this file directly and does
 * not read `tsconfig.json`'s path aliases.
 */

/** A wire record, as `EnquiryRecord` in `lib/api/admin-enquiries.ts` describes it. */
function record(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "3f6c1e2a-9b4d-4a1f-8c7e-2d5b0a9e1c33",
    vehicle_id: "a1b2c3d4-1111-2222-3333-444455556666",
    vehicle_slug: "range-rover-sport-autobiography",
    customer_name: "Amina Al-Farsi",
    customer_email: "amina@example.ae",
    customer_phone: "+971 50 123 4567",
    message: "Is this still available, and can I view it on Saturday?",
    status: "pending",
    created_at: "2026-01-14T09:12:03Z",
    updated_at: "2026-01-14T09:12:03Z",
    ...overrides,
  };
}

describe("parseEnquiry", () => {
  it("maps a well-formed record onto the domain type", () => {
    const result = parseEnquiry(record());

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.value.customerName, "Amina Al-Farsi");
    assert.equal(result.ok && result.value.vehicleSlug, "range-rover-sport-autobiography");
    assert.equal(result.ok && result.value.status, "pending");
    assert.equal(result.ok && result.value.createdAt, "2026-01-14T09:12:03Z");
  });

  it("rejects a non-object", () => {
    for (const value of [null, undefined, "a string", 42, true]) {
      assert.equal(parseEnquiry(value).ok, false);
    }
  });

  describe("status", () => {
    it("accepts every value in the union", () => {
      for (const status of ["pending", "answered", "closed"]) {
        const result = parseEnquiry(record({ status }));
        assert.equal(result.ok, true, `expected ${status} to be accepted`);
        assert.equal(result.ok && result.value.status, status);
      }
    });

    it("rejects a status this admin does not recognise, and names it", () => {
      // The core of this file. A cast would let `"responded"` through, and the
      // row would then be unfilterable.
      const result = parseEnquiry(record({ status: "responded" }));

      assert.equal(result.ok, false);
      // The value appears in the message, because "unrecognised" with no value in
      // it leaves a staff member with nothing to report.
      assert.match(result.ok === false ? result.error : "", /responded/);
    });

    it("rejects a near-miss of a real status", () => {
      // Case and whitespace are the shapes an extension or a hand-edited fixture
      // would actually produce, and a `switch` written as `case "Pending"` would
      // fall through both of them.
      for (const status of ["Pending", "PENDING", " pending", "pending ", "closed-ish", ""]) {
        assert.equal(parseEnquiry(record({ status })).ok, false, `expected ${JSON.stringify(status)} rejected`);
      }
    });

    it("rejects a missing status rather than defaulting to pending", () => {
      // Defaulting would invent a fact. An enquiry with no status is a backend
      // problem, and rendering it as "pending" would put a record nobody
      // necessarily needs to answer into the answer-it-now column.
      assert.equal(parseEnquiry(record({ status: undefined })).ok, false);
      assert.equal(parseEnquiry(record({ status: null })).ok, false);
    });

    it("rejects a non-string status", () => {
      for (const status of [1, true, {}, []]) {
        assert.equal(parseEnquiry(record({ status })).ok, false);
      }
    });
  });

  describe("required fields", () => {
    it("rejects a record missing any field the staff UI draws", () => {
      // Each of these renders as visible text on the detail page, so a blank one
      // is a page with a hole in it.
      for (const field of [
        "id",
        "vehicle_id",
        "vehicle_slug",
        "customer_name",
        "customer_email",
        "customer_phone",
        "message",
      ]) {
        const result = parseEnquiry(record({ [field]: undefined }));
        assert.equal(result.ok, false, `expected missing ${field} to be rejected`);
        // Not the field's name - the message is prose ("not attached to a
        // vehicle"), because a staff member reads it and has to act on it, and
        // "vehicle_id: missing" helps nobody. What is asserted is that it says
        // something, since an empty reason would render as a blank red row.
        assert.ok(
          result.ok === false && result.error.length > 0,
          `expected a message for missing ${field}`,
        );
      }
    });

    it("rejects a field that is present but empty", () => {
      // An empty string is not a value. `"message": ""` would render a detail
      // page with a blank body and no indication anything is wrong.
      assert.equal(parseEnquiry(record({ message: "" })).ok, false);
      assert.equal(parseEnquiry(record({ message: "   " })).ok, false);
    });

    it("rejects a field of the wrong type", () => {
      assert.equal(parseEnquiry(record({ id: 42 })).ok, false);
      assert.equal(parseEnquiry(record({ message: { text: "hello" } })).ok, false);
    });
  });

  describe("normalisation", () => {
    it("collapses whitespace in the name and email", () => {
      // A name and an email are single-line fields by nature. "  Amina   Al-Farsi  "
      // is stored with its outer whitespace already stripped but its inner runs
      // intact, and three spaces inside a table cell is a typo, not information.
      const result = parseEnquiry(
        record({ customer_name: "  Amina   Al-Farsi  ", customer_email: "  amina@example.ae  " }),
      );

      assert.equal(result.ok, true);
      assert.equal(result.ok && result.value.customerName, "Amina Al-Farsi");
      assert.equal(result.ok && result.value.customerEmail, "amina@example.ae");
    });

    it("trims the message without touching its layout", () => {
      // Only the ends. The backend's `str_strip_whitespace` does the same and
      // leaves the inside alone, so a leading blank line is a formatting accident
      // worth removing - but the newlines between the lines are the visitor's.
      const result = parseEnquiry(record({ message: "\n\nIs this  available?\n\n" }));

      assert.equal(result.ok, true);
      assert.equal(result.ok && result.value.message, "Is this  available?");
    });

    it("keeps the line breaks a visitor used to separate their questions", () => {
      // The test that would have caught the original bug. Collapsing the message
      // turned a three-question enquiry into one run-on sentence, and a staff
      // member replying to it could easily answer two of the three. The detail
      // page renders this with `whitespace-pre-wrap`, so the layout the visitor
      // typed is what they actually see.
      const typed = "Is this still available?\nCan I view on Saturday?\nIs the price negotiable?";
      const result = parseEnquiry(record({ message: typed }));

      assert.equal(result.ok, true);
      assert.equal(result.ok && result.value.message, typed);
    });

    it("keeps a blank line the visitor typed inside the message", () => {
      // A deliberate paragraph break inside the body is as much theirs as one
      // between questions, and there is no way to tell it from an accident - so
      // it is kept. Guessing wrong here would silently edit a customer's words.
      const typed = "Hello,\n\nI saw this on the site and wanted to ask about it.";
      const result = parseEnquiry(record({ message: typed }));

      assert.equal(result.ok, true);
      assert.equal(result.ok && result.value.message, typed);
    });

    it("leaves the phone number's own spacing alone", () => {
      // Deliberately different from the other fields: a phone number's internal
      // spaces and punctuation are how the person reading it recognises their own
      // number, and they are about to dial it. Collapsing "+971  50 123 4567"
      // would be a cosmetic edit to a value being typed into a handset.
      const result = parseEnquiry(record({ customer_phone: "  +971  50 123 4567  " }));

      assert.equal(result.ok, true);
      assert.equal(result.ok && result.value.customerPhone, "+971  50 123 4567");
    });

    it("preserves the message's content exactly, including markup", () => {
      // React escapes on render, which is what makes a visitor's text safe. The
      // parser must not "help" by stripping angle brackets, because that would
      // change what the customer wrote and there is nothing here that needs
      // protecting against the stored value.
      const hostile = '<script>alert("xss")</script> & "quotes" & \'apostrophes\'';
      const result = parseEnquiry(record({ message: hostile }));

      assert.equal(result.ok, true);
      assert.equal(result.ok && result.value.message, hostile);
    });
  });

  describe("timestamps", () => {
    it("keeps a parseable timestamp as the API sent it", () => {
      // Not re-serialised. The backend already emits UTC with an offset, so the
      // value is unambiguous and reformatting it here would be a second opinion
      // about a timestamp the database is authoritative for.
      const result = parseEnquiry(record({ created_at: "2026-01-14T09:12:03+04:00" }));

      assert.equal(result.ok, true);
      assert.equal(result.ok && result.value.createdAt, "2026-01-14T09:12:03+04:00");
    });

    it("defaults an unreadable timestamp to empty rather than rejecting the record", () => {
      // The important asymmetry. A record with a broken timestamp is still a
      // customer's request that somebody has to answer, and refusing to display it
      // would hide it from the person whose job that is - the one failure this
      // file exists to prevent. The pages render the gap honestly.
      for (const value of [undefined, null, "", "not a date", 12345]) {
        const result = parseEnquiry(record({ created_at: value, updated_at: value }));
        assert.equal(result.ok, true, `expected created_at=${JSON.stringify(value)} to survive`);
        assert.equal(result.ok && result.value.createdAt, "");
        assert.equal(result.ok && result.value.updatedAt, "");
      }
    });
  });
});

describe("parseEnquiryPage", () => {
  it("parses a page of records", () => {
    const result = parseEnquiryPage({
      items: [record(), record({ id: "second", status: "answered" })],
      total: 2,
      page: 1,
      per_page: 20,
    });

    assert.equal(result.items.length, 2);
    assert.equal(result.total, 2);
    assert.equal(result.page, 1);
    assert.equal(result.perPage, 20);
    assert.equal(result.skipped, 0);
    // `items` holds parsed values, not parse results - a row that failed to
    // parse was already dropped and counted, so there is nothing left to narrow
    // at the call site.
    assert.equal(result.items[1].status, "answered");
    assert.equal(result.items[0].customerName, "Amina Al-Farsi");
  });

  it("drops an unreadable row and reports how many were skipped", () => {
    // The count is the point. A dropped row is a record the page cannot show, and
    // on a screen whose purpose is "did we lose somebody's request", a silent drop
    // looks exactly like data loss.
    const result = parseEnquiryPage({
      items: [record(), record({ id: "bad", status: "responded" }), record({ message: "" })],
      total: 3,
      page: 1,
      per_page: 20,
    });

    assert.equal(result.items.length, 1);
    assert.equal(result.skipped, 2);
    // The backend's `total` is left alone: it counts every match server-side, and
    // inventing a corrected number here would be a lie about the database.
    assert.equal(result.total, 3);
  });

  it("returns an empty page for a missing or malformed envelope", () => {
    // The list must render, not throw. A page whose counts cannot be read is
    // better shown as empty than as an error boundary on a screen a staff member
    // opens several times a day.
    for (const value of [null, undefined, "a string", {}, { items: "not an array" }]) {
      const result = parseEnquiryPage(value);
      assert.deepEqual(result.items, []);
      assert.equal(result.total, 0);
    }
  });

  it("falls back to a safe page and size rather than rendering nonsense", () => {
    // `page: 0` would make "Showing 1-0 of 0" appear above an empty list; a
    // non-numeric total would put `NaN` in the pager.
    const result = parseEnquiryPage({ items: [], total: "many", page: 0, per_page: -5 });

    assert.equal(result.page, 1);
    assert.equal(result.perPage, 20);
    assert.equal(result.total, 0);
  });

  it("rejects a negative or fractional count", () => {
    const result = parseEnquiryPage({ items: [], total: -3, page: 1.5, per_page: 20 });

    assert.equal(result.total, 0);
    assert.equal(result.page, 1);
  });

  it("handles an empty page that is genuinely empty", () => {
    // Distinct from the malformed cases above: a real empty page must come through
    // as empty, and must not be confused with a parse failure.
    const result = parseEnquiryPage({ items: [], total: 0, page: 1, per_page: 20 });

    assert.equal(result.items.length, 0);
    assert.equal(result.total, 0);
    assert.equal(result.skipped, 0);
  });
});
