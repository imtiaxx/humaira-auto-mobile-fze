/**
 * WhatsApp deep-link construction.
 *
 * ---------------------------------------------------------------------------
 * The one rule
 * ---------------------------------------------------------------------------
 * `buildWhatsAppUrl` returns `null` unless it is certain the result dials a real
 * number. It never returns a best guess, never falls back to a default, and
 * never returns a URL for a number that failed validation.
 *
 * A WhatsApp link is a telephone call. If this function guesses, the site
 * silently routes customers to a stranger's phone - the failure is invisible
 * until a real enquiry goes to the wrong person, and there is no error to trace
 * because the request succeeded. Returning `null` and letting the caller render
 * nothing is the only safe failure mode, so absence of a number is a supported,
 * tested state rather than an error.
 *
 * Pure functions, no framework imports: this is the layer worth being able to
 * test directly.
 */

/**
 * Digit count permitted by ITU-T E.164.
 *
 * 7 is the shortest real national number; 15 is the maximum E.164 length. The
 * upper bound matters as much as the lower one - a 30-digit string is a
 * configuration mistake, and dialling it would produce a dead link that looks
 * structurally valid.
 */
const MIN_DIGITS = 7;
const MAX_DIGITS = 15;

/**
 * Extracts a dialable digit string from whatever a human typed into the
 * environment variable, or `null` if it cannot be a phone number.
 *
 * Accepts the formats a person would plausibly write:
 *   +971501234567   0501234567   00971501234567   (050) 123-4567
 *
 * Rejects anything with stray characters, because a number containing letters
 * or symbols is a typo, and a typo that reaches `wa.me` is a dead link.
 */export function normaliseWhatsAppNumber(input: string | null | undefined): string | null {
  if (typeof input !== "string") return null;

  const trimmed = input.trim();
  if (trimmed === "") return null;

  // `+` is the only permitted non-digit, and only in leading position: it is the
  // E.164 prefix marker, not decoration.
  const withoutPrefix = trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;

  // Everything left must be a digit, a space, or common phone punctuation. This
  // is checked before stripping so a stray letter fails instead of being
  // silently removed and turning "0501234567x" into a plausible number.
  if (!/^[\d\s().-]+$/.test(withoutPrefix)) return null;

  const digits = withoutPrefix.replace(/\D/g, "");

  // Strip a leading `00` international-dialling prefix.
  //
  // `00971501234567` is a very common way for a person to write an international
  // number, and it is accepted above, so it has to be handled here: `wa.me`
  // expects a bare E.164 number and would treat the `00` as part of it, producing
  // a link to a number that does not exist. No E.164 country code begins with
  // `0`, so removing the prefix cannot damage a legitimate number.
  const idd = digits.startsWith("00") ? digits.slice(2) : digits;

  if (idd.length < MIN_DIGITS || idd.length > MAX_DIGITS) return null;

  return idd;
}

/**
 * True when `input` is a number this module is willing to build a link for.
 * Use this to decide whether to render a CTA at all.
 */
export function hasWhatsAppNumber(input: string | null | undefined): boolean {
  return normaliseWhatsAppNumber(input) !== null;
}

/**
 * Builds a `wa.me` deep link, or returns `null` when no valid number is
 * configured.
 *
 * @param number  The configured WhatsApp number, in any of the accepted formats.
 * @param message Optional pre-filled text. Encoded for you.
 *
 * The message exists so a later step can hand off context - "I'm interested in
 * vehicle ABC-123" - without every call site having to remember to encode it.
 * Unencoded, a message containing `&`, `#` or a space produces a link that
 * silently truncates or breaks.
 */
export function buildWhatsAppUrl(
  number: string | null | undefined,
  message?: string,
): string | null {
  const digits = normaliseWhatsAppNumber(number);
  if (digits === null) return null;

  const base = `https://wa.me/${digits}`;

  if (message === undefined || message.trim() === "") return base;

  return `${base}?text=${encodeURIComponent(message.trim())}`;
}

/**
 * A neutral, non-committal default message.
 *
 * Deliberately says nothing about stock, pricing or availability, and names no
 * vehicle: the same default has to be safe on the homepage, on a listing and on
 * an export page. Pages with real context pass their own `message`.
 */
export const DEFAULT_WHATSAPP_MESSAGE =
  "Hello Humera Automobile, I would like to enquire about a vehicle.";
