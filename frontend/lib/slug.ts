/**
 * URL slug normalisation.
 *
 * ---------------------------------------------------------------------------
 * Why this lives on its own
 * ---------------------------------------------------------------------------
 * Two features need the identical rule and neither can be rewritten for the
 * other's convenience:
 *
 * - `features/vehicles/lib/vehicle-schema.ts` normalises a slug on the way *in*,
 *   so a stored slug matches an incoming request whatever case it was written in.
 * - `features/staff/lib/vehicle-form.ts` normalises a slug on the way *out*, so
 *   a slug a staff member typed becomes something that works as a URL.
 *
 * When those were two copies they would drift, and the symptom would be a vehicle
 * whose editor screen and whose public page disagree about its own address - a
 * 404 that only appears for vehicles someone has since edited. So there is one
 * implementation, imported by both.
 *
 * It is its own module, with no imports at all, for a second reason: the unit
 * tests run on Node's built-in test runner, which cannot resolve this project's
 * `@/` path alias. A module with no runtime imports is testable no matter which
 * file imports it, and this rule is worth testing on its own anyway - it is the
 * function that decides what a public URL looks like.
 *
 * ---------------------------------------------------------------------------
 * What it does, and what it deliberately does not do
 * ---------------------------------------------------------------------------
 * Lower-cases, folds whitespace/underscores/slashes to hyphens, drops anything a
 * URL path segment would have to percent-encode, and collapses repeated hyphens.
 *
 * It never *invents* a slug. A make and a model are not enough to derive one
 * safely, because a slug is a permanent public address: deriving it from fields
 * that get corrected later breaks every link to the vehicle. So the function
 * returns `null` for input with nothing slug-safe in it, and callers decide what
 * that means - a record with no slug is rejected on the way in, and the staff
 * form asks for one on the way out.
 */

/**
 * Normalises a value into a slug, or returns `null` if nothing survives.
 *
 * `null` rather than `""` because the two mean different things to the callers:
 * an empty field in a form is a missing value, and a field containing only
 * characters that cannot appear in a URL is a *present* value that cannot be
 * used. Merging them would show a staff member "this field is required" for
 * something they did type.
 */
export function normaliseSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  const cleaned = trimmed
    .toLowerCase()
    .replace(/[\s_/]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned.length > 0 ? cleaned : null;
}
