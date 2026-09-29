"use client";

/**
 * The website enquiry form on a vehicle detail page.
 *
 * ---------------------------------------------------------------------------
 * Why this is the only client component on the page
 * ---------------------------------------------------------------------------
 * The page around it is a Server Component and should stay one: the vehicle is
 * fetched on the server, and the WhatsApp CTA beside this form needs no
 * JavaScript to work. This form needs some, because `useActionState` reports
 * the pending state and holds the submitted values across the round trip, so
 * marking the whole file `"use client"` would ship the vehicle's specification to
 * the browser in order to draw a form.
 *
 * That is why the form is split out of `vehicle-enquiry.tsx` rather than added to
 * it. The split point is the one that matters: data fetching and the CTA stay on
 * the server, and only the form that needs a round trip comes to the browser.
 *
 * ---------------------------------------------------------------------------
 * Why a server action and not `fetch`
 * ---------------------------------------------------------------------------
 * See `app/actions/enquiries.ts`. Briefly: the API is a different origin, so a
 * browser POST needs CORS for a write and a preflight, and the backend's address
 * would end up in client JavaScript. The action is one same-origin request this
 * server makes on the visitor's behalf.
 *
 * ---------------------------------------------------------------------------
 * Why the values are echoed back
 * ---------------------------------------------------------------------------
 * A failed submission must not cost the visitor their message. `useActionState`
 * holds whatever the action returned, so the inputs render with the last
 * submitted values and only the control that was actually rejected is marked.
 * The form is never re-rendered blank after a failure.
 */

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { EnquiryFormState } from "@/app/actions/enquiries";
import { submitEnquiryAction } from "@/app/actions/enquiries";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EMAIL_MAX,
  MESSAGE_MAX,
  MESSAGE_MIN,
  NAME_MAX,
  PHONE_MAX,
  PHONE_MIN,
} from "@/features/vehicles/lib/enquiry-form";

export function EnquiryForm({
  slug,
  vehicleName,
}: {
  /** The vehicle's slug, taken from the page's own route. */
  slug: string;
  /** Used only in the heading, so the visitor knows what they are asking about. */
  vehicleName: string;
}) {
  // Bound as a closure so the slug cannot arrive as a form field. A visitor who
  // edits the hidden input in devtools changes a value nothing reads; the vehicle
  // is decided by the route and, independently, re-resolved by the backend.
  const [state, formAction] = useActionState<EnquiryFormState, FormData>(
    submitEnquiryAction.bind(null, slug),
    null,
  );

  // Narrowed once so the fields read `failure?.errors?.customer_name` rather
  // than repeating the discriminant at every control.
  const failure = state?.ok === false ? state : null;
  const success = state?.ok === true ? state : null;

  // A success replaces the form. A visitor who has been told "thank you" and is
  // left looking at four empty boxes is being asked a second time whether they
  // want to make an enquiry, and the obvious second answer is no.
  if (success) {
    return (
      <div aria-labelledby="website-enquiry-heading" className="flex flex-col gap-4">
        <h3
          id="website-enquiry-heading"
          className="text-sm text-fg-muted uppercase tracking-wider"
        >
          Enquire about {vehicleName}
        </h3>
        <FormMessage tone="success">{success.message}</FormMessage>
        <p className="text-body-sm text-fg-muted">
          Prefer WhatsApp? The button above opens a chat with the same details
          already filled in.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} aria-labelledby="website-enquiry-heading" className="flex flex-col gap-5">
      <h3
        id="website-enquiry-heading"
        className="text-sm text-fg-muted uppercase tracking-wider"
      >
        Enquire about {vehicleName}
      </h3>

      {/* `role="alert"` and `aria-live` come from `FormMessage`. */}
      {failure !== null ? <FormMessage tone="danger">{failure.message}</FormMessage> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={failure?.errors?.customer_name}>
          <Input
            name="customer_name"
            type="text"
            autoComplete="name"
            required
            maxLength={NAME_MAX}
            defaultValue={failure?.values?.customerName ?? ""}
            invalid={Boolean(failure?.errors?.customer_name)}
          />
        </Field>

        <Field label="Email" required error={failure?.errors?.customer_email}>
          <Input
            name="customer_email"
            type="email"
            // `autoComplete="email"` so a returning visitor is not asked to
            // retype an address the browser already knows, and `email` so mobile
            // keyboards show the right layout.
            autoComplete="email"
            inputMode="email"
            required
            maxLength={EMAIL_MAX}
            defaultValue={failure?.values?.customerEmail ?? ""}
            invalid={Boolean(failure?.errors?.customer_email)}
          />
        </Field>
      </div>

      <Field
        label="Phone"
        required
        error={failure?.errors?.customer_phone}
        help="A phone number is required so the dealership can reach you directly."
      >
        <Input
          name="customer_phone"
          type="tel"
          // `tel` rather than a pattern-guarded `text`: it is what makes a
          // mobile keyboard offer digits and a plus key.
          autoComplete="tel"
          inputMode="tel"
          required
          minLength={PHONE_MIN}
          maxLength={PHONE_MAX}
          placeholder="+971 50 123 4567"
          defaultValue={failure?.values?.customerPhone ?? ""}
          invalid={Boolean(failure?.errors?.customer_phone)}
        />
      </Field>

      <Field label="Message" required error={failure?.errors?.message}>
        <Textarea
          name="message"
          rows={4}
          required
          minLength={MESSAGE_MIN}
          maxLength={MESSAGE_MAX}
          placeholder="Tell us what you would like to know about this vehicle."
          defaultValue={failure?.values?.message ?? ""}
          invalid={Boolean(failure?.errors?.message)}
        />
      </Field>

      <SubmitEnquiryButton />
    </form>
  );
}

/**
 * The submit button, split out so it can read the form's pending state.
 *
 * `useFormStatus` only reports status for the form it is rendered inside, so this
 * has to be a child of the `<form>` rather than a prop passed down. `loading`
 * also sets `disabled`, which is what stops a second submission while the first
 * is in flight - a double-tap on a phone would otherwise file two enquiries, and
 * the unique constraint on `(vehicle_id, customer_email)` would turn the second
 * into an error the visitor did nothing to deserve.
 */
function SubmitEnquiryButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" loading={pending} loadingText="Sending">
      Send enquiry
    </Button>
  );
}
