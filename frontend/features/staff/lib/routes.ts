/**
 * The staff area's routes, in one place.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists
 * ---------------------------------------------------------------------------
 * For the same reason `navigation/config.ts` does, and the same benefit: a path
 * that is spelled out in four components is a path that will be spelled
 * differently in one of them. `/staff/vehicles` appears in the nav, on the
 * dashboard's "view all" link, after a successful create, and in every
 * `revalidatePath` call. Four copies of a URL is four chances to introduce a
 * stale one that still compiles, and the symptom is a redirect to a 404 that only
 * a staff member ever sees.
 *
 * The values are inferred as string *literals*, which is the important detail:
 * with `typedRoutes` enabled, `next/link` and `redirect()` only accept a path the
 * compiler has confirmed exists in the app directory. A constant typed as `string`
 * would have to be cast to satisfy them, and a cast is exactly the hole that
 * would let a renamed route through. Declared this way, renaming a page without
 * updating its uses is a build failure.
 */

/** The dashboard, and the landing page after signing in. */
export const STAFF_HOME = "/staff";

/**
 * The one staff route reachable without a session.
 *
 * Also the destination of every failed guard, and the route `signOutAction`
 * returns to. It sits outside the authenticated group on purpose - see
 * `app/staff/(app)/layout.tsx` - so a redirect here cannot loop.
 */
export const STAFF_LOGIN = "/staff/login";

/** The vehicle list, including archived vehicles. */
export const STAFF_VEHICLES = "/staff/vehicles";

/** The enquiry list for staff management. */
export const STAFF_ENQUIRIES = "/staff/enquiries";

/** The "add a vehicle" form. */
export const STAFF_NEW_VEHICLE = "/staff/vehicles/new";

/** The editor for one vehicle, which also owns its photographs. */
export function staffVehicle(vehicleId: string): `/staff/vehicles/${string}` {
  return `/staff/vehicles/${vehicleId}`;
}
