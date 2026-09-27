"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signInAction } from "@/app/staff/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Stack } from "@/components/ui/stack";
import type { LoginState } from "@/features/staff/lib/action-state";

/**
 * The sign-in form.
 *
 * ---------------------------------------------------------------------------
 * Why `useActionState` and not `useState` plus a `fetch`
 * ---------------------------------------------------------------------------
 * Because the credential never reaches the browser's JavaScript. With
 * `useActionState`, React hands the `FormData` straight to `signInAction` on the
 * server; the password is read there, exchanged for a token, and dropped. There
 * is no client state holding it, no promise resolving into one, and nothing for
 * an XSS bug to read out of a React DevTools panel.
 *
 * The cost is one full server round trip per attempt, which for a form with two
 * fields is not a cost anybody can perceive.
 *
 * ---------------------------------------------------------------------------
 * Why the password is never echoed back
 * ---------------------------------------------------------------------------
 * `signInAction` returns the email address on failure so the staff member does not
 * retype it, and deliberately does not return the password. Re-rendering a
 * password into a DOM node puts it in the page source, in
 * `document.body.innerHTML`, and in anything that reads form fields - which is
 * the opposite of what an `input type="password"` is for. It is not an
 * autoComplete question; the value simply is not put back.
 */
export function StaffLoginForm() {
  // `null` for the initial state; see the note in `action-state.ts` on why success
  // is a value rather than an absence.
  const [state, formAction] = useActionState<LoginState, FormData>(signInAction, null);

  // A sign-in either redirects or fails, so only the failure branch is ever
  // rendered. Narrowed once here rather than at each use, so the fields below read
  // as `failure?.errors?.email` instead of repeating the discriminant.
  const failure = state?.ok === false ? state : null;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {/*
        `role="alert"` and `aria-live` come from `FormMessage`, which sets the role
        from the tone. A failed sign-in has to be announced: the fields re-render
        unchanged and nothing else on the page moves, so a screen reader user would
        otherwise have no indication that anything happened.
      */}
      {failure !== null ? <FormMessage tone="danger">{failure.message}</FormMessage> : null}

      <Field label="Email address" error={failure?.errors?.email}>
        <Input
          name="email"
          type="email"
          // `autoComplete="username"` so a password manager offers the stored
          // credential, and `email` so mobile keyboards show the right layout.
          autoComplete="username"
          inputMode="email"
          required
          // The email is restored, so it has to be a controlled-looking default
          // rather than an empty field: the action's return value is the only
          // thing that survives the round trip.
          defaultValue={failure?.values?.email ?? ""}
          invalid={Boolean(failure?.errors?.email)}
        />
      </Field>

      <Field label="Password" error={failure?.errors?.password}>
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          // Never `defaultValue`. See the note above.
          invalid={Boolean(failure?.errors?.password)}
        />
      </Field>

      <SignInButton />
    </form>
  );
}

/**
 * The submit button, split out so it can read the form's pending state.
 *
 * `useFormStatus` only reports status for the form it is rendered inside, so this
 * has to be a child of the `<form>` rather than something the form passes a prop
 * down. `loading` also sets `disabled`, which is what stops a second attempt being
 * submitted while the first is in flight - two concurrent sign-ins would race, and
 * whichever lost would overwrite the session cookie.
 */
function SignInButton() {
  const { pending } = useFormStatus();

  return (
    <Stack gap="sm">
      <Button type="submit" loading={pending} loadingText="Signing in">
        Sign in
      </Button>

      {/*
        A quiet reminder of what this form is for, because the alternative -
        a "forgot your password?" link - would be a dead end. There is no password
        reset in this application: the backend has no reset route, and inventing a
        link to one would be a promise the product does not keep.
      */}
      <p className="text-body-sm text-fg-muted">
        No password reset. An operator can reset your password from the command
        line.
      </p>
    </Stack>
  );
}
