/**
 * The vehicle comparison: parsing a selection, and shaping a comparison.
 *
 * ---------------------------------------------------------------------------
 * What this is for
 * ---------------------------------------------------------------------------
 * `navigation/config.ts` declares `Compare Cars` as a `planned` destination at
 * `/compare`, and both `docs/api.md` and `docs/architecture.md` list
 * `/vehicles/compare` as a named future endpoint. This module is the frontend
 * half of that feature, and it is deliberately not the endpoint.
 *
 * ---------------------------------------------------------------------------
 * Why the selection lives in the query string
 * ---------------------------------------------------------------------------
 * Because that is the pattern this site already established, in `filters.ts` and
 * on `/inventory`: the query string *is* the state of the page, there is no
 * client-side state, and the page renders with JavaScript disabled. A comparison
 * chosen in `localStorage` or React state would be unreproducible - the visitor
 * could not bookmark it, share it, or open it on a second device, and a dealer
 * asking a customer "which two did you look at?" would have no answer.
 *
 * So `/compare?vehicles=slug-a&vehicles=slug-b` is the whole feature, and it is
 * a real address from the first render.
 *
 * ---------------------------------------------------------------------------
 * Why this is a projection, not a served resource
 * ---------------------------------------------------------------------------
 * The obvious design is a new `POST /vehicles/compare` taking slugs and
 * returning a comparison. It is rejected on three grounds:
 *
 *   1. **It answers a question the data already answers.** A comparison is the
 *      published vehicles, side by side. `listVehicles()` is one request for all
 *      of them, and resolving N slugs against one array is a `filter`. An
 *      endpoint would move that to a second round trip and add a schema to keep
 *      in step with `Vehicle` for no new information.
 *   2. **It would be a public, unauthenticated POST** whose only effect is to
 *      return data the caller could already fetch with a GET. That is a request
 *      an attacker can make at volume, for a response they could equally have
 *      got with one GET. There is no state to protect, so nothing is gained.
 *   3. **The list route already hides unpublished stock.** An aggregate
 *      endpoint would be a *second* place that has to remember to filter on
 *      `archived_at IS NULL`, and a comparison that leaked a draft would leak it
 *      next to three real cars where nobody would notice.
 *
 * This is the same reasoning as `brands.ts`, applied to selection: the shape of
 * `compareSelection` is the seam an endpoint would replace, not the page.
 *
 * ---------------------------------------------------------------------------
 * The one thing that is genuinely untrusted here
 * ---------------------------------------------------------------------------
 * Everything else in this feature reads from the database. This module's input
 * is a **query string**, which is attacker-controlled, so it is treated as such:
 *
 *   - `MAX_COMPARISON` caps the selection. This is a request cap before it is a
 *     layout cap: resolving slugs means work proportional to their number, and
 *     an unbounded `?vehicles=` repeated 50,000 times is a cheap way to make a
 *     public page do work on demand. It is also the width at which a
 *     side-by-side table stops being readable on a phone, so the two limits are
 *     the same number for the same reason.
 *   - Each slug is checked against `SLUG_PATTERN` and length-capped, so a
 *     megabyte of junk cannot reach a `Map` lookup or a comparison key.
 *   - Refused input is dropped and reported, never forwarded - the same rule
 *     `filters.ts` follows for a mistyped filter, so a bad value produces a
 *     message rather than a silently wrong table.
 */

import type { Vehicle } from "@/types/vehicle";

/** The query-string key carrying the selection. Singular in the type, plural in use. */
export const COMPARISON_KEY = "vehicles";

/**
 * Most vehicles that can be compared at once.
 *
 * Four, not three, and not ten. Three is the most a phone can show as distinct
 * columns before the label column is squeezed to nothing, and four is the point
 * past which "compare" becomes a spreadsheet nobody reads. It is also the cap on
 * work done per request, which is the reason that matters.
 */
export const MAX_COMPARISON = 4;

/** Fewer than two is not a comparison, so the page says so rather than rendering one column. */
export const MIN_COMPARISON = 2;

/**
 * The documented shape of a slug: lowercase, hyphen-separated.
 *
 * Checked rather than trusted, and deliberately *not* used to decide whether a
 * slug is real - `resolveComparison` answers that against the published set. A
 * hand-typed or hand-edited address that fails the pattern is refused outright
 * instead of being silently dropped as "not found", because "that is not a valid
 * address" and "we do not have that car" are different answers and conflating
 * them sends the visitor looking for a car that was never on the site.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Matches the `VARCHAR(120)` the column is declared with, per docs/database.md. */
const SLUG_MAX_LENGTH = 120;

/** A requested slug, after normalisation, before it is matched against the catalogue. */
export interface ComparisonRequest {
  /** Normalised, pattern-checked, de-duplicated. Order is the visitor's. */
  readonly slugs: readonly string[];
  /** Requested values refused by the pattern or the length cap. */
  readonly malformed: readonly string[];
  /** Valid slugs discarded because the selection was already at the cap. */
  readonly overLimit: readonly string[];
  /** True when the visitor supplied more valid slugs than `MAX_COMPARISON`. */
  readonly truncated: boolean;
}

/** The result of matching a selection against what is actually published. */
export interface ComparisonResult {
  /** Matched vehicles, in the order requested. Never contains a duplicate. */
  readonly vehicles: readonly Vehicle[];
  /** Valid slugs that matched no published vehicle, in request order. */
  readonly unmatched: readonly string[];
  /**
   * How many further *real* vehicles the visitor asked for that the table had no
   * room for. A count rather than a list of slugs, because the page says "one more
   * you asked for exists but there is no room" - naming cars it is not showing
   * would invite a click that goes nowhere.
   *
   * Distinct from the parse-time `truncated`, which counts values discarded
   * before they were ever checked against the catalogue: those may not be real
   * vehicles at all.
   */
  readonly overflow: number;
}

/**
 * Reads the selection from a query string.
 *
 * Accepts both shapes a browser and a human produce, because the form and a
 * shared link disagree about which is natural:
 *
 *   - `?vehicles=a&vehicles=b` - what a `<form method="get">` with checkboxes
 *     named `vehicles` submits. Repeated keys, so `searchParams` gives a
 *     `string[]`.
 *   - `?vehicles=a,b` - what a person types when they edit the address bar, and
 *     the shorter form to share.
 *
 * Supporting only the first would make a hand-edited link silently compare one
 * vehicle named `a,b`. Supporting only the second would mean the form cannot use
 * native checkboxes at all, because a native GET form cannot join its values
 * into one field. `filters.ts` takes the same "support the shape the visitor
 * actually has" position, and takes the *last* value of a repeated key; here
 * every value is wanted, so all of them are collected.
 */
export function parseComparison(
  params: URLSearchParams | Record<string, string | string[] | undefined> = {},
): ComparisonRequest {
  const raw: string[] = [];

  if (params instanceof URLSearchParams) {
    for (const value of params.getAll(COMPARISON_KEY)) raw.push(...value.split(","));
  } else {
    const value = params[COMPARISON_KEY];
    if (Array.isArray(value)) {
      for (const entry of value) raw.push(...entry.split(","));
    } else if (typeof value === "string") {
      raw.push(...value.split(","));
    }
  }

  const slugs: string[] = [];
  const malformed: string[] = [];
  const overLimit: string[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    // Normalised exactly as `getVehicleBySlug` normalises, so a value that
    // resolves on the detail page resolves here too. The two functions must not
    // disagree about what counts as the same slug.
    const slug = entry.trim().toLowerCase();

    // An empty value is nothing rather than something wrong. `?vehicles=` and a
    // trailing comma are what a form submits when nothing is ticked, so reporting
    // them as malformed would show a visitor an error for the ordinary case of
    // "I have not chosen yet".
    if (slug === "") continue;

    if (slug.length > SLUG_MAX_LENGTH || !SLUG_PATTERN.test(slug)) {
      malformed.push(entry);
      continue;
    }
    // A repeated slug is a mistake, not a second vehicle, and rendering it twice
    // would let one car appear to be two - which is the one thing a comparison
    // must never do.
    if (seen.has(slug)) continue;
    seen.add(slug);

    if (slugs.length >= MAX_COMPARISON) {
      overLimit.push(slug);
      continue;
    }
    slugs.push(slug);
  }

  return {
    slugs,
    malformed,
    overLimit,
    truncated: overLimit.length > 0,
  };
}

/**
 * Matches a parsed selection against the published vehicles.
 *
 * Takes the array rather than fetching, so it is pure and testable, and so the
 * page reads the catalogue once for both the comparison and the picker.
 */
export function resolveComparison(
  vehicles: readonly Vehicle[],
  slugs: readonly string[],
): ComparisonResult {
  const bySlug = new Map<string, Vehicle>();
  for (const vehicle of vehicles) {
    // First spelling wins, matching `getVehicleBySlug`, so the two cannot
    // disagree about which vehicle a slug names.
    const key = vehicle.slug.trim().toLowerCase();
    if (!bySlug.has(key)) bySlug.set(key, vehicle);
  }

  const matched: Vehicle[] = [];
  const seen = new Set<string>();
  const unmatched: string[] = [];
  let overflow = 0;

  for (const wanted of slugs) {
    // Normalised here as well as in the parser, so the two cannot disagree. It
    // also means resolution stays correct if a future caller skips the parser -
    // a page should not depend on "the other function already cleaned this up"
    // to match a vehicle's own slug case-insensitively.
    const slug = wanted.trim().toLowerCase();
    const vehicle = bySlug.get(slug);

    if (vehicle === undefined) {
      unmatched.push(slug);
      continue;
    }
    if (seen.has(slug)) continue;
    seen.add(slug);

    if (matched.length >= MAX_COMPARISON) {
      // Counted rather than listed. The vehicles are real, and saying how many
      // there are is the useful half; the other half is "there is no room", which
      // the cap itself already implies.
      overflow += 1;
      continue;
    }
    matched.push(vehicle);
  }

  return { vehicles: matched, unmatched, overflow };
}

/** True when the selection is a real comparison rather than a single vehicle. */
export function isComparable(count: number): boolean {
  return count >= MIN_COMPARISON;
}

/**
 * The comparison address for a set of slugs.
 *
 * Repeated keys, not a joined list, because that is what the form submits and
 * what `parseComparison` reads first. Encoded, for the reason `makePath` gives:
 * a slug is a URL segment, and this one is assembled in JavaScript from values
 * the visitor typed.
 *
 * Nothing selected is the bare `/compare`, not `/compare?`. The empty-query
 * address is what a naive join produces, it looks like a broken link in the
 * address bar and in a shared message, and it reaches here whenever a removal
 * link is generated for a selection that has already been emptied.
 */
/**
 * One `vehicles=<slug>` pair, typed so the literal key survives into the address.
 *
 * The declared return type is doing the work. Inferred on its own, a template
 * literal in a `map` callback widens to `string`, and the assembled address then
 * widens to `` `/compare?${string}` `` - which is not a route, so every `Link`
 * that renders a removal link fails to type-check. Here the type is asserted at
 * the point it is actually true, and TypeScript verifies the body produces it.
 *
 * `makePath` in `brands.ts` needs none of this because `?make=` is written
 * literally in the middle of its template. A repeated key joined by `&` cannot
 * express its own structure, so it is stated here.
 */
function comparisonPair(slug: string): `vehicles=${string}` {
  return `${COMPARISON_KEY}=${encodeURIComponent(slug)}`;
}

export function comparePath(
  slugs: readonly string[],
): `/compare?vehicles=${string}` | "/compare" {
  const pairs = slugs.filter((slug) => slug !== "").map(comparisonPair);

  if (pairs.length === 0) return "/compare";

  /*
    The cast is on `join`, and it is the one place in the file that needs one.
    `String.prototype.join` returns `string`, and TypeScript cannot see through it
    to the `vehicles=` prefix that `comparisonPair` put in every element - so the
    whole address widens to `` `/compare?${string}` ``, which is not a `Route` and
    makes every `Link` that renders a removal link fail to compile.

    The prefix is not merely hoped for: it is checked by `comparisonPair`'s
    return type, and the empty case is returned above rather than assembled. Next's
    own typed-routes documentation prescribes a cast for exactly this, a computed
    href TypeScript cannot verify structurally. The alternative - typing the
    return as `` `/compare?${string}` `` - would compile and then hand the router
    an address it has no route for, which is a 404 at runtime instead of a build
    failure.
  */
  return `/compare?${pairs.join("&")}` as `/compare?vehicles=${string}`;
}

/**
 * The comparison address with one vehicle removed.
 *
 * The removal control is a link rather than a button with a click handler, so
 * removing a column is a navigation, the address bar always holds the current
 * comparison, and it works with JavaScript disabled. It also means the browser
 * Back button undoes a removal, which a client-state implementation would have
 * to reimplement.
 *
 * Removing the last vehicle leaves the picker rather than an address for an
 * empty table, which `comparePath` handles now that it is the one place that
 * knows what an empty selection's address is.
 */
export function withoutVehicle(
  slugs: readonly string[],
  remove: string,
): `/compare?vehicles=${string}` | "/compare" {
  const kept = slugs.filter((slug) => slug.toLowerCase() !== remove.trim().toLowerCase());
  return comparePath(kept);
}
