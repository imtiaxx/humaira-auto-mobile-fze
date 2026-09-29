import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMAIL_MAX,
  MESSAGE_MAX,
  MESSAGE_MIN,
  NAME_MAX,
  PHONE_MAX,
  PHONE_MIN,
  fieldErrorsFromDetail,
  parseEnquiryForm,
} from "./enquiry-form.ts";

/**
 * The public form's own validation.
 *
 * ---------------------------------------------------------------------------
 * What these tests are actually protecting
 * ---------------------------------------------------------------------------
 * Two things, and the second is the one that is easy to forget.
 *
 * The first is that a *valid* submission is not rejected. This is a convenience
 * layer in front of the backend, and the failure mode of a badly written client
 * check is not a bad error message - it is refusing an enquiry from somebody who
 * then never knows why. Every "accepts" case below is that guard.
 *
 * The second is that the values come back on failure. A server action is a round
 * trip, so a rejected submission that discards what was typed makes a visitor
 * retype a message they have already written. That is why `parseEnquiryForm`
 * returns `values` on both paths, and why asserting it is not padding.
 *
 * ---------------------------------------------------------------------------
 * The drift caveat
 * ---------------------------------------------------------------------------
 * These bounds duplicate the backend's `EnquiryWrite`. Duplication is accepted
 * here and the tests are what keep it honest - but the tests cannot detect a
 * change made only on the Python side, because nothing in this file reads it. The
 * real protection against that is the action: a backend 422 replaces these
 * messages, and `fieldErrorsFromDetail` below is tested with the exact envelope
 * `backend/app/core/errors.py` produces so that path is proven to work.
 *
 * Relative `.ts` specifiers, because `node --test` runs this file directly and does
 * not read `tsconfig.json`'s path aliases.
 */

/** A `FormData` with the four fields, overridable per test. */
function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const values: Record<string, string> = {
    customer_name: "Amina Al-Farsi",
    customer_email: "amina@example.ae",
    customer_phone: "+971 50 123 4567",
    message: "Is this still available, and can I view it on Saturday?",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe("parseEnquiryForm", () => {
  it("accepts a well-formed submission", () => {
    const result = parseEnquiryForm(form());

    assert.equal(result.ok, true);
    assert.deepEqual(result.ok && result.values, {
      customerName: "Amina Al-Farsi",
      customerEmail: "amina@example.ae",
      customerPhone: "+971 50 123 4567",
      message: "Is this still available, and can I view it on Saturday?",
    });
  });

  it("trims every field", () => {
    // The backend runs `str_strip_whitespace` too, but a stored value with
    // leading blanks is what the staff UI would show, so trimming here means the
    // confirmation the visitor sees matches what gets stored.
    const result = parseEnquiryForm(
      form({
        customer_name: "  Amina Al-Farsi  ",
        customer_email: "  amina@example.ae  ",
        message: "\n\n  Is this still available?  \n",
      }),
    );

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.values.customerName, "Amina Al-Farsi");
    assert.equal(result.ok && result.values.customerEmail, "amina@example.ae");
    assert.equal(result.ok && result.values.message, "Is this still available?");
  });

  it("returns the submitted values alongside the errors", () => {
    // The reason `values` is on the failure path. A visitor who mistypes their
    // email must not lose their message.
    const result = parseEnquiryForm(form({ customer_email: "not-an-email" }));

    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.values.message, "Is this still available, and can I view it on Saturday?");
    assert.ok(result.ok === false && result.errors.customer_email);
  });

  it("reports every invalid field at once rather than stopping at the first", () => {
    // Stopping early would make a visitor fix one field per submission.
    const result = parseEnquiryForm(
      form({ customer_name: "A", customer_email: "nope", customer_phone: "123", message: "short" }),
    );

    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(Object.keys(result.errors).sort(), [
      "customer_email",
      "customer_name",
      "customer_phone",
      "message",
    ]);
  });

  describe("customer_name", () => {
    it("rejects a name shorter than the backend's minimum", () => {
      assert.equal(parseEnquiryForm(form({ customer_name: "A" })).ok, false);
    });

    it("rejects a name longer than the backend's maximum", () => {
      const result = parseEnquiryForm(form({ customer_name: "a".repeat(NAME_MAX + 1) }));
      assert.equal(result.ok, false);
    });

    it("accepts a name at exactly the boundary lengths", () => {
      assert.equal(parseEnquiryForm(form({ customer_name: "Jo" })).ok, true);
      assert.equal(parseEnquiryForm(form({ customer_name: "a".repeat(NAME_MAX) })).ok, true);
    });

    it("accepts names in scripts it has never heard of", () => {
      // The backend's `NAME_PATTERN` is an allowlist of *excluded* characters, not
      // a list of permitted alphabets, precisely so this works. A client check that
      // said `[A-Za-z]` would reject a real customer, which is the worse failure.
      assert.equal(parseEnquiryForm(form({ customer_name: "علي الحسن" })).ok, true);
      assert.equal(parseEnquiryForm(form({ customer_name: "李伟" })).ok, true);
      assert.equal(parseEnquiryForm(form({ customer_name: "Ólafur Þórsson" })).ok, true);
      assert.equal(parseEnquiryForm(form({ customer_name: "O'Brien-Smith Jr." })).ok, true);
    });
  });

  describe("customer_email", () => {
    it("rejects the shapes that are certainly not addresses", () => {
      for (const email of [
        "not-an-email",
        "missing@tld",
        "@example.ae",
        "spaces in@example.ae",
        "two@@example.ae",
        "trailing@",
      ]) {
        assert.equal(
          parseEnquiryForm(form({ customer_email: email })).ok,
          false,
          `expected ${email} to be rejected`,
        );
      }
    });

    it("accepts ordinary and unusual but valid addresses", () => {
      for (const email of [
        "amina@example.ae",
        "first.last@example.co.uk",
        "first+tag@example.com",
        "a@b.co",
      ]) {
        assert.equal(
          parseEnquiryForm(form({ customer_email: email })).ok,
          true,
          `expected ${email} to be accepted`,
        );
      }
    });

    it("rejects an address longer than RFC 5321 allows", () => {
      const long = `${"a".repeat(EMAIL_MAX)}@example.ae`;
      assert.equal(parseEnquiryForm(form({ customer_email: long })).ok, false);
    });
  });

  describe("customer_phone", () => {
    it("rejects a number shorter than the backend's minimum", () => {
      assert.equal(parseEnquiryForm(form({ customer_phone: "12345" })).ok, false);
      // The boundary itself, rather than a value chosen to be obviously short. A
      // hardcoded short number passes for the wrong reason: it would also pass if
      // the minimum were raised to something absurd. Only the exact boundary
      // distinguishes "too short" from "not a phone number".
      assert.equal(parseEnquiryForm(form({ customer_phone: "1".repeat(PHONE_MIN - 1) })).ok, false);
    });

    it("accepts a number at exactly the minimum length", () => {
      assert.equal(parseEnquiryForm(form({ customer_phone: "1".repeat(PHONE_MIN) })).ok, true);
    });

    it("rejects a number longer than the backend's maximum", () => {
      assert.equal(parseEnquiryForm(form({ customer_phone: "9".repeat(PHONE_MAX + 1) })).ok, false);
    });

    it("accepts the punctuation styles people actually type", () => {
      for (const phone of [
        "+971501234567",
        "+971 50 123 4567",
        "050 123 4567",
        "+971 (50) 123-4567",
      ]) {
        assert.equal(
          parseEnquiryForm(form({ customer_phone: phone })).ok,
          true,
          `expected ${phone} to be accepted`,
        );
      }
    });

    it("does not attempt to be stricter than the backend about formatting", () => {
      // The backend's own pattern allows any of the interior characters, and this
      // layer must not reject something the server would have stored. A stricter
      // client check would make a valid phone look invalid to the visitor, and
      // the visitor is the only one who can tell.
      assert.equal(parseEnquiryForm(form({ customer_phone: "+971--50..123.4567" })).ok, true);
    });
  });

  describe("message", () => {
    it("rejects a message shorter than the backend's minimum", () => {
      assert.equal(parseEnquiryForm(form({ message: "too short" })).ok, false);
      assert.equal(parseEnquiryForm(form({ message: "a".repeat(MESSAGE_MIN - 1) })).ok, false);
    });

    it("accepts a message at exactly the minimum length", () => {
      assert.equal(parseEnquiryForm(form({ message: "a".repeat(MESSAGE_MIN) })).ok, true);
    });

    it("rejects a message longer than the backend's maximum", () => {
      assert.equal(parseEnquiryForm(form({ message: "a".repeat(MESSAGE_MAX + 1) })).ok, false);
    });

    it("does not police the contents of a message", () => {
      // The backend deliberately accepts any text here, because escaping at render
      // time is what makes it safe. A client check that rejected these would refuse
      // real customers for no security benefit at all.
      const hostile = '<script>alert("xss")</script> DROP TABLE enquiries; --';
      assert.equal(parseEnquiryForm(form({ message: hostile })).ok, true);
    });

    it("sends the message's line breaks through unchanged", () => {
      // The other end of the same round trip. The backend stores these newlines,
      // the staff parser keeps them, and the staff detail page renders them with
      // `whitespace-pre-wrap` - so the only place they could be lost on the way
      // out is here. A visitor who typed three separate questions has to arrive at
      // the dealership as three separate questions.
      const typed = "Is this still available?\nCan I view on Saturday?\nIs the price negotiable?";
      const result = parseEnquiryForm(form({ message: typed }));

      assert.equal(result.ok, true);
      assert.equal(result.ok && result.values.message, typed);
    });

    it("still trims the blank lines around a message", () => {
      // Trimming the ends is different from collapsing the middle, and both are
      // wanted: a textarea's trailing newlines are an artefact of pressing Enter,
      // while the ones in the middle are the point.
      const result = parseEnquiryForm(form({ message: "\n\nStill available?\n\n" }));

      assert.equal(result.ok, true);
      assert.equal(result.ok && result.values.message, "Still available?");
    });
  });

  describe("missing fields", () => {
    it("treats an entirely empty form as four errors, not a crash", () => {
      const result = parseEnquiryForm(new FormData());

      assert.equal(result.ok, false);
      assert.equal(result.ok === false && Object.keys(result.errors).length, 4);
    });

    it("reports a non-string field as absent", () => {
      // A file input or an empty submit button arrives as a `File`, not a string.
      // Coercing it would store the string "[object File]".
      //
      // `delete` first, because `FormData.get` returns the *first* value for a
      // key: appending to the existing valid value would leave that one in front
      // and the test would pass for the wrong reason.
      const data = form();
      data.delete("customer_name");
      data.append("customer_name", new File(["x"], "name.txt"));

      const result = parseEnquiryForm(data);
      assert.equal(result.ok === false && result.errors.customer_name !== undefined, true);
    });
  });
});

describe("fieldErrorsFromDetail", () => {
  it("maps the backend's 422 detail onto field names", () => {
    // The exact shape `backend/app/core/errors.py` produces: `error.details` is a
    // list of Pydantic errors, each with a `loc` list and a `msg`.
    const detail = [
      { loc: ["body", "customer_email"], msg: "String should match pattern", type: "string_pattern_mismatch" },
      { loc: ["body", "message"], msg: "String should have at least 10 characters", type: "string_too_short" },
    ];

    assert.deepEqual(fieldErrorsFromDetail(detail), {
      customer_email: "String should match pattern",
      message: "String should have at least 10 characters",
    });
  });

  it("takes the last element of loc, because that is the field name", () => {
    // `loc` is `["body", "customer_email"]`. Indexing 0 would produce a message
    // keyed "body", which matches no control, so the visitor would see the
    // summary line and no highlighted field - the exact failure this replaces.
    const detail = [{ loc: ["body", "customer_name"], msg: "Too short", type: "string_too_short" }];

    assert.deepEqual(fieldErrorsFromDetail(detail), { customer_name: "Too short" });
  });

  it("keeps the first message for a field that has several", () => {
    // A field with two problems is common - a `min_length` and a `pattern`
    // failure at once - and one line of text is all a control can show.
    const detail = [
      { loc: ["body", "customer_phone"], msg: "First problem", type: "x" },
      { loc: ["body", "customer_phone"], msg: "Second problem", type: "y" },
    ];

    assert.deepEqual(fieldErrorsFromDetail(detail), { customer_phone: "First problem" });
  });

  it("ignores a query-parameter error, which names no form field", () => {
    // A `loc` of `["query", "page"]` would otherwise be keyed "page" and shown
    // against nothing. Dropping it is right: the summary line covers it.
    const detail = [
      { loc: ["query", "page"], msg: "Input should be greater than or equal to 1", type: "greater_than_equal" },
      { loc: ["body", "message"], msg: "Too short", type: "string_too_short" },
    ];

    assert.deepEqual(fieldErrorsFromDetail(detail), { message: "Too short" });
  });

  it("returns an empty object for a payload it does not recognise", () => {
    // The action falls back to the summary line when this is empty, so an
    // unexpected shape must not produce a field keyed "undefined".
    assert.deepEqual(fieldErrorsFromDetail(null), {});
    assert.deepEqual(fieldErrorsFromDetail(undefined), {});
    assert.deepEqual(fieldErrorsFromDetail("a string"), {});
    assert.deepEqual(fieldErrorsFromDetail({ code: "validation_error" }), {});
    assert.deepEqual(fieldErrorsFromDetail([]), {});
  });

  it("skips entries that are malformed rather than throwing", () => {
    const detail = [
      null,
      "a string",
      { loc: "not-an-array", msg: "No loc" },
      { loc: ["body", "message"] },
      { msg: "No loc at all" },
      { loc: ["body", "message"], msg: "The one that is valid", type: "x" },
    ];

    assert.deepEqual(fieldErrorsFromDetail(detail), { message: "The one that is valid" });
  });

  it("does not treat a numeric field name as a form field", () => {
    // Pydantic reports a body that is not an object with `loc: ["body", 0]`. The
    // last element is a number, so it is skipped and the action shows its summary.
    const detail = [{ loc: ["body", 0], msg: "Input should be a valid dictionary", type: "model_attributes_type" }];

    assert.deepEqual(fieldErrorsFromDetail(detail), {});
  });
});
