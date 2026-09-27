/**
 * Optimistic route guard for the staff area.
 *
 * ---------------------------------------------------------------------------
 * Next 16: this file is `proxy.ts`, not `middleware.ts`
 * ---------------------------------------------------------------------------
 * Middleware was renamed. A `middleware.ts` in this project would be ignored, and
 * the failure mode of an ignored guard is the dangerous kind: everything appears
 * to work, because the real check in `lib/staff/dal.ts` is doing the work, and
 * nobody notices the Proxy has stopped running until the day it is the only thing
 * left.
 *
 * ---------------------------------------------------------------------------
 * What this checks, and what it deliberately does not
 * ---------------------------------------------------------------------------
 * It checks that a session cookie is **present**. That is all. The token is
 * opaque, so this file cannot tell a live session from a revoked, expired or
 * forged one, and it makes no attempt to - there is nothing here to attempt it
 * with.
 *
 * This is the arrangement Next's authentication guide asks for. Proxy runs on
 * every route including prefetched ones, so a database or API call in here would
 * be paid on every navigation to every page, and the guide is explicit that most
 * security checks belong as close as possible to the data. So:
 *
 *   - Proxy: is there a cookie? Cheap, on every request, and allowed to be wrong
 *     in the optimistic direction.
 *   - `lib/staff/dal.ts`: is the session actually live? Expensive, and the
 *     authoritative answer, asked once per render.
 *
 * A staff member whose session expired sees one redirect to the login form rather
 * than an empty admin page, and nothing is ever rendered on the strength of this
 * check alone. A staff member who *is* signed in is never blocked by it, because
 * a false negative would be the expensive kind - it would hide a working session
 * behind a login form for no reason.
 *
 * ---------------------------------------------------------------------------
 * Why the matcher excludes `_next` and media
 * ---------------------------------------------------------------------------
 * The guide notes that for auth, running Proxy on all routes is recommended. That
 * advice is about not leaving a hole; the exclusions below do not create one,
 * because nothing under `_next/static`, `_next/image` or `/media` renders admin
 * data. They are here because this site is image-heavy - every vehicle card loads
 * several photographs from the backend - and running a cookie check in front of
 * every one of those requests is work for a file that is already public.
 *
 * The admin area's own images are a genuine exception to "media is public": they
 * come from the backend's `/media` mount on a *different* origin, so they never
 * pass through this Proxy at all. They are fetched by the browser from
 * `NEXT_PUBLIC_API_URL` and this file has no involvement in them.
 */

import { NextResponse, type NextRequest } from "next/server";

import { STAFF_SESSION_COOKIE } from "@/lib/staff/session-cookie";
import { STAFF_HOME, STAFF_LOGIN } from "@/features/staff/lib/routes";

/** True for `/staff` and everything under it, except the login form itself. */
function isProtectedStaffPath(pathname: string): boolean {
  if (pathname === STAFF_LOGIN) return false;
  return pathname === STAFF_HOME || pathname.startsWith(`${STAFF_HOME}/`);
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // `req.cookies` rather than `cookies()` from `next/headers`: the request is
  // already in hand here, and reaching for the async cookie store in a function
  // that runs on every request would add a promise to a check whose entire job is
  // to be cheap. The guide lists both forms; this is the one that fits.
  const hasSession = Boolean(request.cookies.get(STAFF_SESSION_COOKIE)?.value);

  if (isProtectedStaffPath(pathname) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = STAFF_LOGIN;
    // Not carrying the original path as a `next` parameter on purpose. It would
    // need validating against the set of real staff routes to avoid being an open
    // redirect, and the area is small enough that the dashboard is a fine place to
    // arrive. The trade is a deliberate one, not an oversight.
    url.search = "";
    return NextResponse.redirect(url);
  }

  // ---------------------------------------------------------------------------
  // Nothing here bounces an apparently-signed-in visitor off `/staff/login`
  // ---------------------------------------------------------------------------
  // An earlier version of this file did, on the reasoning that a live session has
  // no use for a login form. That reasoning is sound and the implementation is an
  // infinite redirect loop, because "has a cookie" is not "has a session":
  //
  //   stale cookie  ->  proxy sends /staff/login to /staff
  //                ->  the layout's authoritative check gets a 401
  //                ->  `requireStaff` redirects to /staff/login
  //                ->  the proxy sees the same stale cookie, and repeats.
  //
  // The cookie can be stale for entirely ordinary reasons: a session expired
  // overnight, a staff member signed out on another device, a token was revoked.
  // The loop is also the *hostile* shape - it turns a harmless expired cookie into
  // a browser that spins.
  //
  // The correct place for this check is the login page, which already has it: it
  // calls `getStaffSession()`, and a genuinely live session redirects to the
  // dashboard from there, with the API's answer rather than a cookie's existence.
  // That also fixes the loop rather than hiding it, because the redirect that
  // closes it is the authoritative one.
  return NextResponse.next();
}

export const config = {
  /**
   * Everything except Next's own build output and the public media mount.
   *
   * Public site routes are included deliberately rather than narrowed to
   * `/staff`, because the login redirect is the one transition a signed-in
   * staff member can trigger from anywhere - by following a bookmark to
   * `/staff/login` from a page on the marketing site.
   */
  matcher: [
    "/((?!_next/static|_next/image|media|.*\\.(?:png|jpg|jpeg|webp|avif|svg|ico|woff2?)$).*)",
  ],
};
