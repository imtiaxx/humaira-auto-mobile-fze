/**
 * Client-side checks for the public enquiry form.
 *
 * ---------------------------------------------------------------------------
 * Why this is a module and not a body of JSX
 * ---------------------------------------------------------------------------
 * Because these rules are worth testing, and a rule that can only be exercised by
 * rendering a form is a rule nothing tests. The functions here are pure, take a
 * `FormData`, and return a result - so `enquiry-form.test.ts` can assert on them
 * directly, exactly as `vehicle-form.test.ts` does for the staff side.
 *
 * ---------------------------------------------------------------------------
 * Why this is not the authority
 * ---------------------------------------------------------------------------
 * It is not, and it is not trying to be. Everything here is duplicated by the
 * backend's `EnquiryWrite`, which is what actually decides what gets stored, and
 * the duplication is deliberate: a person on a slow connection should be told
 * about a missing email before the round trip, not after.
 *
 * The cost of duplication is drift - these constants and the backend's `Field`
 * bounds could disagree. That is accepted, and the mitigation is that the
 * backend's answer wins on the form: a 422 from the API replaces whatever this
 * module believed, and its per-field messages are shown. A rule that only exists
 * in the browser is a convenience; a rule that only exists in the browser *and is
 * treated as final* would be a bug.
 */

/** Minimum characters in a name. Matches the backend's `min_length=2`. */
export const NAME_MIN = 2;
/** Maximum characters in a name. Matches the backend's `max_length=200`. */
export const NAME_MAX = 200;
/** Maximum characters in an email. Matches RFC 5321 and the backend. */
export const EMAIL_MAX = 320;
/** Minimum characters in a phone number, punctuation included. */
export const PHONE_MIN = 7;
/** Maximum characters in a phone number, punctuation included. */
export const PHONE_MAX = 50;
/** Minimum characters in a message. Matches the backend's `min_length=10`. */
export const MESSAGE_MIN = 10;
/** Maximum characters in a message. Matches the backend's `max_length=2000`. */
export const MESSAGE_MAX = 2000;

/**
 * The same shape as `app.schemas.enquiry.EMAIL_PATTERN`.
 *
 * Deliberately not an attempt at RFC 5322. It rejects the addresses that are
 * certainly wrong, which is the same trade the backend's `StaffEmail` makes and
 * for the same reason: no `email-validator` dependency for one field.
 */
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** What the form collected, trimmed. */
export interface EnquiryFormValues {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  message: string;
}

export type ParseResult =
  | { ok: true; values: EnquiryFormValues }
  | { ok: false; errors: Record<string, string>; values: EnquiryFormValues };

/** Reads one text field out of a `FormData` as a trimmed string. */
function text(form: FormData, key: string): string {
  const raw = form.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Checks the form and returns either the values to send or the messages to show.
 *
 * Values are returned on *both* paths, including failure. A server action is a
 * round trip, and a rejected submission that blanks the form makes the visitor
 * retype a message they have already written - so the same values come back
 * with the form, and the caller decides what to re-render.
 */
export function parseEnquiryForm(form: FormData): ParseResult {
  const values: EnquiryFormValues = {
    customerName: text(form, "customer_name"),
    customerEmail: text(form, "customer_email"),
    customerPhone: text(form, "customer_phone"),
    message: text(form, "message"),
  };
  const errors: Record<string, string> = {};

  if (values.customerName.length < NAME_MIN) {
    errors.customer_name = "Enter your name.";
  } else if (values.customerName.length > NAME_MAX) {
    errors.customer_name = `Your name must be ${NAME_MAX} characters or fewer.`;
  }

  if (!EMAIL_PATTERN.test(values.customerEmail)) {
    errors.customer_email = "Enter a valid email address.";
  } else if (values.customerEmail.length > EMAIL_MAX) {
    errors.customer_email = `Your email must be ${EMAIL_MAX} characters or fewer.`;
  }

  if (values.customerPhone.length < PHONE_MIN) {
    errors.customer_phone = "Enter a phone number we can reach you on.";
  } else if (values.customerPhone.length > PHONE_MAX) {
    errors.customer_phone = `Your phone number must be ${PHONE_MAX} characters or fewer.`;
  }

  if (values.message.length < MESSAGE_MIN) {
    errors.message = `Tell us a little more - at least ${MESSAGE_MIN} characters.`;
  } else if (values.message.length > MESSAGE_MAX) {
    errors.message = `Your message must be ${MESSAGE_MAX} characters or fewer.`;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors, values };
  }
  return { ok: true, values };
}

/**
 * Renders a `422` from the API as per-field messages.
 *
 * The backend names the field it rejected, and its error `loc` is a list because a
 * field can have several problems: `["body", "customer_email"]`. Only the last
 * element is the field's name, and only a `loc` that starts with `"body"` describes
 * something this form submitted.
 *
 * That filter is what keeps a *query* or *path* error off the form. The public
 * route takes no query parameters, so it is a hypothetical here - but if the API
 * ever adds one, an error like `["query", "page"]` would otherwise be keyed
 * `"page"` and rendered against no control, so the visitor would see a summary
 * line and no highlighted field. Those fall through to the action's summary, which
 * is the correct place for a message nobody can map to a field.
 *
 * Only the first message per field is kept, which is right for a single-line
 * control and merely terse for a textarea - a visitor fixing the first problem on
 * a field sees the next one on the following submission.
 *
 * Returns an empty object when the payload is not the shape expected, so the
 * caller can fall back to the summary line.
 */
export function fieldErrorsFromDetail(detail: unknown): Record<string, string> {
  if (!Array.isArray(detail)) return {};

  const out: Record<string, string> = {};
  for (const entry of detail) {
    if (typeof entry !== "object" || entry === null) continue;
    const { loc, msg } = entry as { loc?: unknown; msg?: unknown };
    if (!Array.isArray(loc) || typeof msg !== "string") continue;
    if (loc[0] !== "body") continue;

    const field = loc[loc.length - 1];
    if (typeof field !== "string") continue;
    if (field in out) continue;

    out[field] = msg;
  }
  return out;
}
