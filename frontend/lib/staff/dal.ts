/**
 * The staff data access layer.
 *
 * ---------------------------------------------------------------------------
 * Why there are three functions and not one
 * ---------------------------------------------------------------------------
 * Next.js' authentication guide is explicit that the majority of security checks
 * belong as close as possible to the data source, and that Proxy - which runs on
 * every route, including prefetched ones - should do optimistic checks only.
 * This module is the other half of that arrangement:
 *
 * - `getStaffSession()` - read-only. `null` for a signed-out caller. Used where
 *   signing in is optional, and by nothing that then trusts the result.
 * - `requireStaff()` - redirects to the login form. Used by every page in the
 *   admin area, so a request without a live session never reaches a component
 *   that could leak one.
 * - `requireStaffApi()` - the same check, but throws a `401` `ApiError` instead
 *   of redirecting. Used by server actions, where a redirect would discard the
 *   staff member's typed input and replace a "your session expired" message with
 *   a blank form.
 *
 * The distinction between the second and third is the reason this is not one
 * function with a flag: a page and an action fail differently, and asking each
 * call site to remember which failure mode it wants is how a form ends up
 * silently reloading itself.
 *
 * ---------------------------------------------------------------------------
 * What "authenticated" actually means here
 * ---------------------------------------------------------------------------
 * Not "a cookie exists". A cookie is a string the browser can hold, and this
 * server can do nothing with it except hand it back to the backend. So the check
 * is the backend's own `GET /api/v1/auth/me`, which returns `401` for an absent,
 * unknown, expired or revoked session and `403` for a live session belonging to
 * an account that is no longer staff or no longer active.
 *
 * That is the answer to "is this person allowed in", asked of the only component
 * that can know. A token the backend has revoked produces a redirect here, not
 * an admin page.
 *
 * ---------------------------------------------------------------------------
 * Why `cache()`
 * ---------------------------------------------------------------------------
 * A single render can pass through the layout, the page and several components,
 * and each of those may want the signed-in staff member's name. Without
 * memoisation that is one `GET /auth/me` per call site per render. `cache` scopes
 * the deduplication to one render pass and no further, which is exactly the
 * lifetime wanted: a session revoked mid-render should not be hidden by a stale
 * memo, and a fresh request after a mutation must re-check.
 */

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ApiError } from "@/lib/api/errors";
import { getCurrentStaff } from "@/lib/api/staff-auth";
import { parseStaffUser } from "@/features/staff/lib/staff-schema";
import { STAFF_SESSION_COOKIE } from "@/lib/staff/session-cookie";
import { clearStaffSessionCookie } from "@/lib/staff/cookies";
import { STAFF_LOGIN } from "@/features/staff/lib/routes";
import type { StaffUser } from "@/types/staff";

/**
 * True when the incoming request carries a session cookie at all.
 *
 * The cheap pre-check. It exists so `requireStaff()` can send an anonymous
 * visitor to the login form without spending an API round trip on a request
 * that is going to come back `401` - the login page is the common case during
 * development, and on a slow link a needless `fetch` is the difference between
 * an instant redirect and a visible pause.
 */
export async function hasStaffCookie(): Promise<boolean> {
  const store = await cookies();
  const value = store.get(STAFF_SESSION_COOKIE)?.value;
  return typeof value === "string" && value.length > 0;
}

/**
 * The signed-in staff member, or `null`.
 *
 * Never throws for an absent session: `null` *is* the answer, and a caller that
 * treats `null` as an error will be wrong far more often than one that treats a
 * live session as optional. A `403` is still thrown, because reaching this
 * function's caller with a session that exists but is not usable would mean
 * rendering a page for someone who cannot use it.
 */
export const getStaffSession = cache(async (): Promise<StaffUser | null> => {
  if (!(await hasStaffCookie())) return null;

  let record: unknown;
  try {
    record = await getCurrentStaff();
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) return null;
    // A 403 means a live session belonging to an account that is no longer
    // staff. Letting that reach the caller would render an admin shell for
    // someone the backend has already refused, so it is turned into the same
    // "not signed in" answer - the account can be fixed by an operator, and
    // until then this session gets no admin surface.
    if (cause instanceof ApiError && cause.status === 403) return null;
    throw cause;
  }

  // The response is checked, not trusted. `getCurrentStaff` is typed as returning
  // the right shape, but that type is an assertion the transport makes and
  // nothing more, and the admin header renders a name and an email from it
  // directly - so the one place that decides who is signed in is the right place
  // to find out that the account is not a person.
  const parsed = parseStaffUser(record);
  if (!parsed.ok) return null;

  return parsed.value;
});

/**
 * The signed-in staff member, or a redirect to the login form.
 *
 * The guard every admin page calls. Placed in `app/staff/layout.tsx` so it runs
 * once for the whole area rather than being repeated in each page, and repeated
 * guards are guards that eventually get commented out with a "this one is
 * obviously fine" that stops being true.
 */
export async function requireStaff(): Promise<StaffUser> {
  const staff = await getStaffSession();
  if (staff) return staff;

  // ---------------------------------------------------------------------------
  // Why the dead cookie is NOT cleared here
  // ---------------------------------------------------------------------------
  // It is tempting to drop the token here, now that the backend has just said it
  // is expired, revoked or unknown - and doing so is a runtime error, not a
  // no-op. This function runs during a page render, and Next only permits
  // `cookies().set()` from a Server Action or a Route Handler. Calling it from a
  // layout render throws:
  //
  //   Error: Cookies can only be modified in a Server Action or Route Handler.
  //
  // That error is raised *before* `redirect()` is ever reached, so the staff
  // member is shown a 500 error page instead of the login form, and they cannot
  // sign in again from there. The symptom is indistinguishable from "login is
  // broken" for exactly the people most likely to hit it: anyone whose session
  // expired, was revoked, or who carries a cookie from an earlier build.
  //
  // `requireStaffApi` below *can* clear it, because a Server Action may send
  // `Set-Cookie` back, and that is where the token actually gets dropped - on
  // the first action a signed-out staff member submits. A stale cookie left here
  // costs one extra 401 round trip per request until then, and `proxy.ts` lets
  // those requests through by design, because it is only allowed to check that a
  // cookie exists.
  //
  // No attempt to bounce the caller back to the page they asked for. A `next`
  // parameter is an open-redirect waiting to happen unless it is validated
  // against a known set of routes, and the staff area is small enough that
  // landing on its dashboard is a perfectly good outcome.
  redirect(STAFF_LOGIN);
}

/**
 * The signed-in staff member, or an `ApiError` a server action can report.
 *
 * `status: 401` rather than a redirect, because a redirect from a Server Action
 * would throw away whatever the staff member had typed. The action catches this
 * and renders "your session expired, sign in again" in place, keeping the form
 * on screen long enough to be re-submitted deliberately.
 */
export async function requireStaffApi(): Promise<StaffUser> {
  const staff = await getStaffSession();
  if (staff) return staff;

  // The write that `requireStaff` can only attempt. A Server Action *can* send a
  // `Set-Cookie` back, so this is where the dead token is actually removed - and
  // removing it here is what stops the next action from spending another round
  // trip to be told the same thing. The staff member still sees their form and
  // their message; only the credential is gone.
  if (await hasStaffCookie()) {
    await clearStaffSessionCookie();
  }

  throw new ApiError({
    kind: "http",
    status: 401,
    code: "authentication_required",
    message: "Your session has expired. Sign in again to continue.",
  });
}
