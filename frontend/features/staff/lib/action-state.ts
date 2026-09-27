/**
 * Shapes returned by the staff server actions.
 *
 * ---------------------------------------------------------------------------
 * Why success is a value and not an absent one
 * ---------------------------------------------------------------------------
 * Because `useActionState` is initialised with a value, and the value it starts
 * with is indistinguishable from the value a successful action returns. An earlier
 * version of this file documented success as `undefined`, on the reasoning that
 * the state object is only ever rendered on the failure path - and then the
 * vehicle form's docblock promised a "saved" confirmation that could not exist.
 * `undefined` cannot mean both "nothing has happened yet" and "the save worked",
 * so it means neither, and success is a value.
 *
 * `null` is the initial state, and is the one thing that is never rendered.
 *
 * ---------------------------------------------------------------------------
 * Why these are a union and not an interface
 * ---------------------------------------------------------------------------
 * `useActionState` renders whatever the action returns, so the type is the only
 * thing standing between a staff member and a form that shows "undefined" or
 * crashes. Every action returns exactly one of three things: `null` (nothing has
 * happened), a failure, or a success.
 *
 * ---------------------------------------------------------------------------
 * Why failures carry the submitted values
 * ---------------------------------------------------------------------------
 * Because a server action is a round trip, and a round trip that rejects an edit
 * must not cost the staff member the edit. `values` is everything they typed, so
 * the form can be re-rendered filled in. This is the difference between a
 * validation error and data loss, and it is why no action in this area reports a
 * failure by re-rendering a blank form.
 */

import type { VehicleFormValues } from "@/features/staff/lib/vehicle-form";

/** A failure, with optional per-field messages and the submitted values. */
export interface ActionFailure<TValues> {
  /**
   * The discriminator.
   *
   * Not decoration. Both variants carry a `message` - one is an error to read and
   * one is a confirmation - so nothing about their shape tells them apart, and a
   * form cannot know which panel to put the message in. An earlier version tried to
   * infer it from the presence of `errors`, which is wrong whenever a failure has
   * no per-field errors, and would have printed "Photograph order saved." inside a
   * red error banner.
   *
   * A literal `false` rather than an optional flag, so TypeScript narrows on
   * `state.ok` and a variant added later without one is a type error.
   */
  ok: false;
  message: string;
  /** Keyed by field name. `null` values are not used; absence means "no error". */
  errors?: Record<string, string | undefined>;
  /** Everything submitted, so the form can be re-rendered filled in. */
  values?: TValues;
}

/** A completed action. `message` is shown as a confirmation, not an error. */
export interface ActionSuccess {
  /** The discriminator. See `ActionFailure.ok`. */
  ok: true;
  message: string;
}

/**
 * What a form action returns.
 *
 * Generic in the values type because the login form and the vehicle form have
 * nothing in common beyond this envelope, and a combined type would let the login
 * form render a vehicle's feature rows.
 */
export type ActionState<TValues = undefined> =
  | ActionFailure<TValues>
  | ActionSuccess
  | null;

/** The login form's state. No values echoed back - a password is never re-rendered. */
export type LoginState = ActionState<{ email: string }>;

/** The vehicle form's state, carrying every field the staff member submitted. */
export type VehicleFormState = ActionState<VehicleFormValues>;

/**
 * The image manager's state.
 *
 * Carries no values: the image controls submit ids and file lists rather than
 * text, and re-rendering a file input with a previous selection is not possible
 * or desirable. The gallery itself is the server's data, so the form re-reads it
 * after every mutation rather than trying to preserve local state.
 *
 * The upload half of the manager does not use this at all - it posts to a Route
 * Handler, for reasons that are about request size rather than about state. See
 * the note in `features/staff/components/image-manager.tsx`.
 */
export type ImageActionState = ActionState;
