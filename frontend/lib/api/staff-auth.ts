/**
 * Staff authentication endpoint bindings.
 *
 * ---------------------------------------------------------------------------
 * Why login has no cookie-forwarding
 * ---------------------------------------------------------------------------
 * Every other call in this module passes `session: "forward"`. Login must not,
 * and the reason is that there is nothing useful to forward: a caller reaching
 * the login form either has no cookie or has one that did not work. Replaying a
 * stale token on the way in would at best be ignored and at worst attach an
 * expired session to a fresh credential check, which is exactly the kind of
 * coupling that produces a login that succeeds and then signs the user straight
 * back out.
 *
 * ---------------------------------------------------------------------------
 * Why the token is a return value rather than a cookie set here
 * ---------------------------------------------------------------------------
 * The backend sets the cookie on *its* origin and returns the token in the body
 * for callers that are not a browser talking to the API directly. This
 * application is a browser client of a different origin, so it takes the body
 * value and installs the cookie itself in `lib/staff/cookies.ts`. Doing it that
 * way is what keeps the token out of JavaScript: it exists in a server action's
 * memory and in an `httpOnly` cookie, and never in a client bundle,
 * `localStorage`, or the DOM.
 *
 * The alternative - a client-side `fetch` that let the browser store the
 * backend's own cookie - would work in development and put a seven-day staff
 * credential somewhere an XSS bug can read it.
 */

import { apiGet, apiSend } from "@/lib/api/client";

/** A staff account as the backend serialises it. */
export interface StaffUserRecord {
  id: string;
  full_name: string;
  email: string;
  is_staff: boolean;
}

/** Body of a successful `POST /api/v1/auth/login`. */
export interface LoginRecord {
  /** Opaque session token. Installed as an `httpOnly` cookie, never exposed. */
  token: string;
  expires_at: string;
  user: StaffUserRecord;
}

/** Acknowledgement of a sign-out. */
export interface LogoutRecord {
  /** False when there was no live session to revoke. Either way, signed out. */
  revoked: boolean;
}

/**
 * Exchanges credentials for a session token.
 *
 * No session forwarding, for the reason in the module docstring.
 */
export function loginStaff(credentials: {
  email: string;
  password: string;
}): Promise<LoginRecord> {
  return apiSend<LoginRecord>("POST", "/auth/login", { json: credentials });
}

/**
 * Revokes the current session server-side.
 *
 * Forwards the session cookie so the backend can identify which session to
 * revoke. The caller clears its own copy of the cookie afterwards, and the two
 * halves are both necessary: revoking without clearing leaves a credential in
 * the browser that fails confusingly, and clearing without revoking leaves a
 * live session on the server that anyone holding the token could still use.
 */
export function logoutStaff(): Promise<LogoutRecord> {
  return apiSend<LogoutRecord>("POST", "/auth/logout", { session: "forward" });
}

/**
 * The staff account the current session belongs to.
 *
 * `401` for an absent, unknown, expired or revoked session; `403` for a live
 * session whose account is no longer staff or no longer active. This is the
 * authoritative check behind `lib/staff/dal.ts`.
 */
export function getCurrentStaff(): Promise<StaffUserRecord> {
  return apiGet<StaffUserRecord>("/auth/me", { session: "forward" });
}
