"use server";

/**
 * Staff sign-in and sign-out.
 *
 * ---------------------------------------------------------------------------
 * Why these are server actions and not a client `fetch`
 * ---------------------------------------------------------------------------
 * Because of the token. `POST /api/v1/auth/login` returns an opaque session token
 * in its body, and a client-side `fetch` would put that token somewhere browser
 * JavaScript can read - a closure, a promise, a React state value, and eventually
 * a React DevTools panel. From there a single XSS bug, or one third-party script
 * that goes wrong, exfiltrates a seven-day staff credential, and the only
 * recovery is revoking the session by hand.
 *
 * A server action keeps the token in the server's memory and puts it straight into
 * an `httpOnly` cookie. The browser never holds it, never sees it, and cannot
 * read it back out of `document.cookie`. That is the whole reason the admin
 * surface is server-rendered end to end rather than a client-side SPA talking to
 * the API, and it is why the frontend owns the cookie rather than letting the
 * backend set it on its own (different) origin.
 *
 * ---------------------------------------------------------------------------
 * Why sign-out does two things
 * ---------------------------------------------------------------------------
 * It asks the backend to revoke the session, and it clears this origin's cookie.
 * Both are necessary. Clearing without revoking leaves a live credential on the
 * server that whoever holds the token could still use - which matters most
 * precisely when someone believes they have signed out. Revoking without
 * clearing leaves a token in the browser that fails on its next use, so the
 * symptom is a page that bounces to the login form with no explanation.
 *
 * The order is revoke first: a failure to reach the backend should not leave the
 * staff member unable to sign out of this browser.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/errors";
import { loginStaff, logoutStaff } from "@/lib/api/staff-auth";
import {
  clearStaffSessionCookie,
  setStaffSessionCookie,
} from "@/lib/staff/cookies";
import { STAFF_HOME, STAFF_LOGIN } from "@/features/staff/lib/routes";
import type { LoginState } from "@/features/staff/lib/action-state";

/**
 * Messages for the failures a sign-in can actually produce.
 *
 * Keyed by status rather than shown from the response body, for one reason: the
 * backend deliberately returns the same `401` for an unknown address and a wrong
 * password, so this screen must not become a tool for discovering which email
 * addresses have staff accounts. Its own message says exactly that, and does not
 * hint that the address was recognised.
 */
function loginFailure(error: unknown, email: string): LoginState {
  const shared = { email };

  if (error instanceof ApiError) {
    if (error.status === 401) {
      return {
        ok: false,
        message: "That email address and password do not match an account.",
        values: shared,
      };
    }
    if (error.status === 403) {
      // Distinct from a `401` on purpose, and safe to be: it means the
      // credentials were correct, which the person signing in has already
      // proved they know. It tells them to contact an operator rather than to
      // keep guessing at the password.
      return {
        ok: false,
        message: "This account is not a staff account, or it has been deactivated.",
        values: shared,
      };
    }
    return { ok: false, message: error.userMessage, values: shared };
  }

  return {
    ok: false,
    message: "We could not sign you in. Please try again.",
    values: shared,
  };
}

/**
 * Signs a staff member in.
 *
 * The email is echoed back on failure so the form does not have to be retyped,
 * but the password never is. A password is not something to put back into a DOM
 * node after a failure: it would be visible in the page source, in
 * `document.body.innerHTML`, and to anything that reads form fields.
 */
export async function signInAction(
  _previous: LoginState,
  form: FormData,
): Promise<LoginState> {
  const rawEmail = form.get("email");
  const rawPassword = form.get("password");

  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (email === "" || password === "") {
    return {
      ok: false,
      message: "Enter your email address and password.",
      errors: {
        email: email === "" ? "Enter your email address." : undefined,
        password: password === "" ? "Enter your password." : undefined,
      },
      values: { email },
    };
  }

  let issued: Awaited<ReturnType<typeof loginStaff>>;
  try {
    issued = await loginStaff({ email, password });
  } catch (error) {
    return loginFailure(error, email);
  }

  const expiresAt = new Date(issued.expires_at);
  if (Number.isNaN(expiresAt.getTime())) {
    // The token is good but its lifetime is unreadable, so the cookie cannot be
    // given a correct `maxAge`. Refusing here is better than installing a cookie
    // that either expires immediately or outlives the server-side session, and
    // the message is a server fault rather than anything the staff member did.
    return {
      ok: false,
      message: "Sign-in could not be completed. Please try again.",
      values: { email },
    };
  }

  await setStaffSessionCookie(issued.token, expiresAt);

  // The session cookie changed, so anything cached for a signed-out visitor is
  // no longer the right thing to show. `revalidatePath` rather than a full
  // refresh: the redirect that follows renders the admin shell from scratch
  // anyway, and this makes the layout's own cached data re-fetch.
  revalidatePath(STAFF_HOME, "layout");

  // Outside the `try` on purpose. `redirect` signals by throwing, and a `catch`
  // placed around it would swallow the redirect and render a success message on
  // the login page instead.
  redirect(STAFF_HOME);
}

/**
 * Signs the current staff member out.
 *
 * Takes no form data and renders nothing. The form posts to it, it revokes, it
 * clears, and the staff member is sent back to the login form - which is the one
 * place in the admin area that a signed-out visitor is supposed to be able to
 * reach, and which therefore must not sit behind the guard in
 * `app/staff/layout.tsx`. That is why the login form lives in its own route
 * group rather than inside the guarded layout.
 */
export async function signOutAction(): Promise<void> {
  try {
    await logoutStaff();
  } catch {
    // Deliberately swallowed. The cookie is cleared below either way, and a
    // network failure here must not leave the staff member unable to sign out of
    // this browser - the local half of signing out is the half they can see.
  }

  await clearStaffSessionCookie();

  revalidatePath(STAFF_HOME, "layout");
  redirect(STAFF_LOGIN);
}
