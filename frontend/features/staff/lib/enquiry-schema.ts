/**
 * The staff enquiry data boundary.
 *
 * ---------------------------------------------------------------------------
 * Why this is a separate file and not more of `staff-schema.ts`
 * ---------------------------------------------------------------------------
 * The vehicles parser is a large function with a large domain. An enquiry is nine
 * fields with one interesting problem between them: `status` arrives as a `string`
 * and has to become one of three values or be rejected. A fourth file would be
 * two hundred lines of import noise for that, so this stands alone - but it is the
 * same boundary, and it obeys the same two rules.
 *
 * ---------------------------------------------------------------------------
 * The rules, restated because they are the whole point
 * ---------------------------------------------------------------------------
 * *Normalise* what can be derived from what is there, and no further. Outer
 * whitespace is trimmed, because the backend already trims it on write and a
 * leading blank line is a formatting accident rather than something the visitor
 * asked the dealership to read first. Internal whitespace is collapsed *only* in
 * the name and the email, which are single-line fields. The message keeps its
 * layout: the newlines are the only record of how the visitor chose to break up
 * their question, and the detail page renders them with `whitespace-pre-wrap`.
 *
 * *Reject* what would require inventing something. This is the file's real job,
 * and `status` is where it bites. `ENQUIRY_STATUSES` is checked rather than
 * trusted: `apiGet` returns a type assertion, which is erased at runtime, so
 * `status: "responded"` from a backend that had been extended without this admin
 * being updated would be rendered as-is by a naive cast. A staff member working a
 * backlog filters by status; a record silently showing a state outside the enum
 * would disappear from every filter and look like data loss.
 *
 * ---------------------------------------------------------------------------
 * Why the visitor's free text is *not* filtered
 * ---------------------------------------------------------------------------
 * `message` is the field a stranger controls freely, and the answer to "should we
 * validate their words" is that escaping at render time is what makes them safe -
 * which it is, because React does it and no part of this application uses
 * `dangerouslySetInnerHTML`. Rejecting an enquiry because someone's question
 * contains a character we dislike loses a real customer, so nothing is invented
 * about its contents. The bounds below are the backend's, not a content policy.
 *
 * ---------------------------------------------------------------------------
 * The `id`/`vehicleId` UUID check
 * ---------------------------------------------------------------------------
 * Deliberately loose. The identifiers are used to build links and API paths, and
 * `encodeURIComponent` in the binding handles anything. Confirming the server
 * minted a UUID would add a failure mode where a record is unreadable for a
 * reason that has nothing to do with the enquiry.
 */

import type { Enquiry, EnquiryStatus } from "@/types/enquiry";

/** Either a checked value, or a message naming what was wrong. */
export type EnquiryParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function fail<T>(error: string): EnquiryParseResult<T> {
  return { ok: false, error };
}

/** A trimmed, non-empty string, or `null`. */
function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Collapse internal runs of whitespace.
 *
 * Applied to the name and the email, which are single-line fields by nature: a
 * stray newline in a name would break the layout of a table cell that renders it,
 * and it is a typo rather than something the visitor meant to convey. Neither field
 * is a place where whitespace carries meaning.
 */
function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Trim a message's outer whitespace, but keep its inner layout.
 *
 * Deliberately *not* `collapse`. The backend's `str_strip_whitespace` only trims
 * the ends - it does not touch the inside - so the newlines a visitor typed are
 * still in the value by the time it reaches here, and they are the only record of
 * how they chose to lay out their question. A customer who wrote
 *
 *     Is this still available?
 *     Can I view on Saturday?
 *     Is the price negotiable?
 *
 * asked three separate questions, and collapsing that into one line turns it into
 * a single run-on sentence that is easy to reply to having missed the last one.
 * That is a real enquiry answered badly, which is a worse outcome than a slightly
 * untidy display - and the detail page renders this with `whitespace-pre-wrap`, so
 * the layout survives intact on screen.
 */
function trimEdges(value: string): string {
  return value.trim();
}

/** A message is free text, but an empty one is not a message. */
function message(value: unknown): string | null {
  return text(value);
}

/** An ISO timestamp, or `null` when absent or unparseable. */
function timestamp(value: unknown): string | null {
  const raw = text(value);
  if (raw === null) return null;
  return Number.isNaN(Date.parse(raw)) ? null : raw;
}

/** The three states the backend's CHECK constraint allows, or `null`. */
function status(value: unknown): EnquiryStatus | null {
  if (value === "pending" || value === "answered" || value === "closed") return value;
  return null;
}

/**
 * One enquiry, as the staff surface renders it.
 *
 * Every field the staff UI draws is required, so each is checked and the message
 * names it. `createdAt`/`updatedAt` are the exception: they are defaulted to `""`
 * rather than rejected, because a record with an unreadable timestamp is still a
 * record somebody needs to read and answer, and the list sorts on the backend
 * already. The alternative - refusing to display an enquiry because its timestamp
 * was unreadable - would hide a customer's request from the person whose job it
 * is to answer it, which is the one failure this file exists to prevent.
 */
export function parseEnquiry(value: unknown): EnquiryParseResult<Enquiry> {
  if (typeof value !== "object" || value === null) {
    return fail("The enquiry was not an object.");
  }
  const raw = value as Record<string, unknown>;

  const id = text(raw.id);
  if (id === null) return fail("This enquiry has no identifier.");

  const vehicleId = text(raw.vehicle_id);
  if (vehicleId === null) return fail("This enquiry is not attached to a vehicle.");

  const vehicleSlug = text(raw.vehicle_slug);
  if (vehicleSlug === null) return fail("This enquiry has no vehicle slug.");

  const customerName = text(raw.customer_name);
  if (customerName === null) return fail("This enquiry has no customer name.");

  const customerEmail = text(raw.customer_email);
  if (customerEmail === null) return fail("This enquiry has no customer email.");

  const customerPhone = text(raw.customer_phone);
  if (customerPhone === null) return fail("This enquiry has no customer phone number.");

  const body = message(raw.message);
  if (body === null) return fail("This enquiry has no message.");

  const state = status(raw.status);
  if (state === null) {
    // Named out loud, because "unrecognised" with no value in it is the least
    // actionable message in the file.
    return fail(
      `This enquiry has the status ${JSON.stringify(raw.status)}, which this admin does not recognise.`,
    );
  }

  return {
    ok: true,
    value: {
      id,
      vehicleId,
      vehicleSlug,
      customerName: collapse(customerName),
      customerEmail: collapse(customerEmail),
      // Phone keeps its spacing. Unlike a name or a message, a phone number's
      // internal spaces and punctuation are how a human reads it back when
      // dialling, and collapsing "+971  50 123 4567" to single spaces would be a
      // cosmetic edit to a value about to be typed into a handset.
      customerPhone,
      // The message keeps its line breaks - see `trimEdges`. Collapsing it would
      // discard how the visitor chose to lay out their question.
      message: trimEdges(body),
      status: state,
      createdAt: timestamp(raw.created_at) ?? "",
      updatedAt: timestamp(raw.updated_at) ?? "",
    },
  };
}

/** A parsed page, plus how many rows were dropped as unreadable. */
export interface EnquiryPageResult {
  items: Enquiry[];
  total: number;
  page: number;
  perPage: number;
  skipped: number;
}

/**
 * A page of enquiries.
 *
 * Unlike `parseStaffVehicle` this does not reject on a bad *count*, for the same
 * reason the dashboard parser does not: a list whose total is unreadable should
 * still show its rows. A count that is not a non-negative integer becomes `0`,
 * which is the truthful reading of "the backend did not report this" - and a total
 * of `0` makes the pager disappear rather than offering a next page that may not
 * exist.
 *
 * Rows that fail `parseEnquiry` are dropped rather than returned as errors,
 * because the list renders each row through a keyed map and a "this row is
 * unreadable" variant for enquiries would mean repeating the vehicles list's
 * `ListRow` union for a screen with no editing. The dropped count is returned so
 * the page can say how many were skipped, rather than showing a total that
 * quietly disagrees with the rows on screen.
 */
export function parseEnquiryPage(value: unknown): EnquiryPageResult {
  if (typeof value !== "object" || value === null) {
    return { items: [], total: 0, page: 1, perPage: 20, skipped: 0 };
  }
  const raw = value as Record<string, unknown>;

  const records = Array.isArray(raw.items) ? raw.items : [];
  const items: Enquiry[] = [];
  let skipped = 0;
  for (const record of records) {
    const parsed = parseEnquiry(record);
    if (parsed.ok) {
      items.push(parsed.value);
    } else {
      skipped += 1;
    }
  }

  const count = (input: unknown): number => {
    return typeof input === "number" && Number.isInteger(input) && input >= 0 ? input : 0;
  };

  return {
    items,
    // The backend's `total` counts every match, not the page. When a row is
    // dropped the reported total and the visible rows legitimately disagree,
    // which is why the page renders `skipped` alongside rather than trusting
    // either number on its own.
    total: count(raw.total),
    page: count(raw.page) || 1,
    perPage: count(raw.per_page) || 20,
    skipped,
  };
}
