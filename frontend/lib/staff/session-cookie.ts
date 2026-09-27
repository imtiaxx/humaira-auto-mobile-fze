/**
 * The staff session cookie, as this application names it.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists separately from `lib/staff/cookies.ts`
 * ---------------------------------------------------------------------------
 * `proxy.ts` needs to know the cookie's *name* to decide whether a staff route
 * is worth rendering, and nothing else. If the name lived in the module that
 * calls `cookies()` from `next/headers`, the Proxy would inherit that import
 * too, and the Proxy runs on every route in the application - including routes
 * that have nothing to do with staff. Keeping the name here makes the Proxy's
 * dependency a constant and nothing more.
 *
 * ---------------------------------------------------------------------------
 * Why the name matches the backend's
 * ---------------------------------------------------------------------------
 * `backend/app/core/config.py` sets `session_cookie_name = "humera_staff_session"`,
 * and the login server action installs *that same value* on this origin.
 *
 * Reusing the name is deliberate. The token is opaque and is verified only by the
 * backend, so both sides can be described with one word without either being able
 * to forge the other's. A different name here would not add a layer of security -
 * it would add a second thing to keep in sync - and would make the cookie set by
 * `curl` against the API and the one set by the web form look like two
 * unrelated credentials when they are the same session.
 *
 * If the backend's cookie name is ever changed, this constant and that setting
 * must change together. The admin surface is the only thing that will notice.
 */

/** Name of the opaque staff session cookie on this application's origin. */
export const STAFF_SESSION_COOKIE = "humera_staff_session";

/**
 * The backend's default session lifetime: `session_expire_minutes = 60 * 24 * 7`.
 *
 * Mirrored rather than fetched because a cookie that outlives its server-side
 * session is only a slower way of learning you are signed out, and the backend
 * is the authority on expiry regardless. Keeping the two values equal means the
 * browser stops sending the cookie at the same moment the backend stops
 * accepting it, instead of the admin pages quietly redirecting to login after a
 * request that was already doomed.
 */
export const STAFF_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * Attributes for the session cookie.
 *
 * `httpOnly` is the whole reason this surface is built on server actions: a
 * token readable from JavaScript is a token any XSS bug can exfiltrate, and
 * `localStorage` cannot be made unreadable.
 *
 * `sameSite: "lax"` mirrors the backend's own cookie. The admin area only ever
 * issues same-site requests to this origin, and `strict` would break a staff
 * member arriving from a bookmark or a shared link for no security gain.
 *
 * `secure` follows the environment rather than being unconditional, because
 * forcing it on plain-HTTP localhost produces a cookie the browser silently
 * refuses to store - which looks exactly like a login that does not work.
 */
export function sessionCookieOptions(maxAge: number = STAFF_SESSION_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

/**
 * True when a request carries a staff session cookie.
 *
 * An **optimistic** check, and the only kind available at this layer. It
 * answers "does a token exist?" and nothing more: the token is opaque, so this
 * file cannot tell a live session from a revoked or expired one, and it
 * deliberately does not try. A false positive here is harmless - the real check
 * runs in `lib/staff/dal.ts` against the API, and a stale cookie costs one
 * redirect. A false *negative* would be the expensive kind, which is why this
 * only ever fails closed by sending the caller to a page that will authenticate
 * them properly.
 */
export function hasSessionCookie(value: string | undefined | null): boolean {
  return typeof value === "string" && value.length > 0;
}
