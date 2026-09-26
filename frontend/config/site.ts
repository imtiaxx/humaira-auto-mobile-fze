/**
 * Verified business information.
 *
 * ---------------------------------------------------------------------------
 * The rule this file exists to enforce
 * ---------------------------------------------------------------------------
 * Every value here is either (a) confirmed business information, or (b) absent.
 * There are no placeholders, no example.com addresses, no "+971 50 000 0000",
 * and no plausible-looking filler of any kind.
 *
 * This matters more than it might seem. A placeholder that ships is a bug nobody
 * catches: it looks real, it renders in the footer of every page, and it is
 * indistinguishable from a deliberate value to the next person to read the code.
 * Someone eventually publishes a phone number that belongs to a different
 * business. An empty string fails visibly and immediately, so absence is
 * always safer than invention.
 *
 * To add a value, confirm it with the business first, then add it here. Do not
 * "temporarily" fill one in to get a layout to look finished.
 */

/** The business name. Never abbreviated, never reworded. */
export const SITE_NAME = "Humera Automobile";

/**
 * Legal/trading name as it appears on documentation.
 *
 * Kept separate from `SITE_NAME` because the footer will eventually need the
 * registered entity name (for example in a registration line) and it is not
 * always identical to the trading name. Empty means "not yet confirmed" - it is
 * not a licence to invent one.
 */
export const LEGAL_NAME: string | null = null;

/**
 * Showroom address.
 *
 * Confirmed. Rendered as a structured `PostalAddress` so a screen reader
 * announces the lines in a sensible order and a visitor's maps app can parse it.
 *
 * `Ducamz` and `Ras Al Khor` are both part of the address - Ras Al Khor is the
 * district, Ducamz the area within it - so they stay on one line in the order
 * they are written rather than being collapsed into a single field.
 */
export const SHOWROOM = {
  name: "Humera Automobile Showroom",
  street: "Showroom No. 188",
  area: "Ducamz, Ras Al Khor",
  city: "Dubai",
  country: "United Arab Emirates",
  /** ISO 3166-1 alpha-2, for `maps:` links and hreflang later. */
  countryCode: "AE",
} as const;

/**
 * Address lines in display order.
 *
 * Single source of truth: the footer, the contact block and any future page
 * render these rather than restating the address, so it cannot drift or be
 * corrected in one place and missed in another.
 */
export const SHOWROOM_ADDRESS_LINES: readonly string[] = [
  SHOWROOM.street,
  SHOWROOM.area,
  `${SHOWROOM.city}, ${SHOWROOM.country}`,
];

/** The address as a single line, for contexts with no room for line breaks. */
export const SHOWROOM_ADDRESS_ONE_LINE = SHOWROOM_ADDRESS_LINES.join(", ");

/**
 * Contact channels.
 *
 * All three are unconfirmed, so all three are `null`.
 *
 * Each is typed `string | null` rather than `string` so that every call site is
 * forced to handle the unconfigured case at compile time. Making them optional
 * strings instead would let `phone.length` typecheck against `undefined`.
 *
 * - `phone`     E.164 or local display format; a real dialled number.
 * - `email`     a monitored mailbox, not a placeholder.
 * - `whatsapp`  resolved from `NEXT_PUBLIC_WHATSAPP_NUMBER`; see `lib/whatsapp.ts`.
 *   Declared here for completeness but always sourced from the environment, so
 *   that changing it never requires a code change.
 */
export const CONTACT = {
  phone: null as string | null,
  email: null as string | null,
  whatsapp: null as string | null,
  /**
   * Business hours. Absent rather than invented - "Mon-Fri 9am-6pm" is a guess,
   * and a visitor who turns up outside guessed hours is a real cost.
   */
  hours: null as readonly string[] | null,
} as const;

/**
 * Official social profiles.
 *
 * Empty on purpose. An empty array is a working feature: the footer renders the
 * social row only when this is non-empty, so adding a verified profile later is
 * a one-line change and the layout is already correct for it.
 *
 * Do not add a profile URL that has not been confirmed as official. A link to
 * somebody else's page with a similar name is a genuine risk for a business.
 */
export const SOCIAL_LINKS: readonly {
  /** Machine key, e.g. "instagram". Used for the icon and the `aria-label`. */
  network: string;
  /** Verified profile URL, including scheme. */
  href: string;
  /** Human name of the network, e.g. "Instagram". */
  label: string;
}[] = [];

/**
 * A single sentence describing the business, used where a page needs a neutral
 * fallback description before per-page copy is written.
 *
 * Describes only what is already established - a Dubai vehicle sales and export
 * business - and makes no claim about stock, turnover, volume or partnerships.
 */
export const SITE_DESCRIPTION =
  "Humera Automobile is a Dubai-based vehicle sales and international export business.";

/**
 * Reserved wordmark treatment.
 *
 * The official logo does not exist as an asset yet, so the brand is set in type
 * (see `components/brand/logo.tsx`). When the real artwork arrives, only that
 * component changes: the mark, the fallback wordmark and the sizing live there
 * and nowhere else, so the header and footer do not need to be touched.
 */
export const BRAND = {
  /** The wordmark, set in the display face. */
  wordmark: SITE_NAME,
  /**
   * Optional short form for tight spaces such as a mobile header. Currently the
   * full name, because abbreviating the business's own name is a branding
   * decision that should be made deliberately rather than by a layout
   * constraint.
   */
  shortWordmark: SITE_NAME,
  /**
   * Initials used as the mark. Two letters keeps the lockup compact at small
   * sizes and avoids the cramped look of a single letter.
   */
  initials: "HA",
} as const;
