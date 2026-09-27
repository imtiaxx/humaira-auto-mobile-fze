/**
 * Reading and writing the staff session cookie on this origin.
 *
 * ---------------------------------------------------------------------------
 * The two-origin problem this solves
 * ---------------------------------------------------------------------------
 * The backend is a different origin from this site: `localhost:8000` against
 * `localhost:3000` in development, two hostnames in production. A cookie set by
 * the backend belongs to the backend, and the browser will not attach it to a
 * request for this origin. So the token that `POST /api/v1/auth/login` returns
 * in its response body is installed here, on this origin, by the login server
 * action - and every subsequent admin request replays it by hand in
 * `lib/api/client.ts`.
 *
 * The alternative, having the browser call the API directly with
 * `credentials: "include"`, would put a credential and the entire write path
 * back into client JavaScript. That is precisely the arrangement the backend's
 * own docstring rules out, and it is why the admin surface is server actions
 * end to end.
 *
 * ---------------------------------------------------------------------------
 * Why the token is never held in `localStorage`
 * ---------------------------------------------------------------------------
 * Because anything in `localStorage` is readable by any script on the origin.
 * One XSS bug, one third-party script gone wrong, and a seven-day credential
 * that cannot be revoked from the browser is exfiltrated. An `httpOnly` cookie
 * is opaque to `document.cookie` by design; the trade is that only the server
 * can read it, which is the trade we want for a staff surface.
 */

import { cookies } from "next/headers";

import {
  STAFF_SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/staff/session-cookie";

/**
 * The current staff session token, or `undefined` when signed out.
 *
 * This is a *local* read of a cookie. It says nothing about whether the token is
 * still live: the backend may have revoked it, or it may have expired. Use
 * `lib/staff/dal.ts` to find out whether the session is actually usable.
 */
export async function getStaffSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(STAFF_SESSION_COOKIE)?.value;
}

/**
 * Installs the session cookie after a successful sign-in.
 *
 * `maxAge` is derived from the backend's `expires_at` rather than from this
 * application's own clock. The two disagree by however long the login request
 * took, and a browser holding a cookie for longer than the server honours it
 * produces an admin area that redirects to the login form while the cookie still
 * looks valid to everything in between.
 *
 * @param token - `token` from the login response body.
 * @param expiresAt - `expires_at` from the same response.
 */
export async function setStaffSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const seconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

  // A non-positive remainder means the session is already over. Writing the
  // cookie anyway would hand the browser a credential that fails on first use,
  // and the symptom of that is a sign-in that appears to succeed and then
  // bounces straight back to the login form.
  if (seconds <= 0) return;

  const store = await cookies();
  store.set(STAFF_SESSION_COOKIE, token, {
    ...sessionCookieOptions(),
    maxAge: seconds,
  });
}

/**
 * Removes the session cookie.
 *
 * The attributes must match the ones it was set with or the browser keeps the
 * original, which is why both paths go through `sessionCookieOptions()` rather
 * than repeating literals.
 */
export async function clearStaffSessionCookie(): Promise<void> {
  const store = await cookies();
  const { httpOnly, sameSite, secure, path } = sessionCookieOptions();
  store.set(STAFF_SESSION_COOKIE, "", { httpOnly, sameSite, secure, path, maxAge: 0 });
}
