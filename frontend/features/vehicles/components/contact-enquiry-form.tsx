"use client";

/**
 * The Contact page enquiry form.
 *
 * ---------------------------------------------------------------------------
 * Why this is a client component
 * ---------------------------------------------------------------------------
 * `useActionState` reports the pending state and holds the submitted values across
 * the round trip, so this needs JavaScript. It is split out of
 * `contact-page.tsx` for the same reason `enquiry-form.tsx` is split out of
 * `vehicle-enquiry.tsx`: the page around it stays a Server Component, so the
 * vehicle list it fetched is passed in as props rather than re-fetched in the
 * browser, and only the form that needs a round trip is client code.
 *
 * ---------------------------------------------------------------------------
 * Why "Vehicle of interest" is a select of real vehicles
 * ---------------------------------------------------------------------------
 * Because the backend cannot store an enquiry without one. `Enquiry.vehicle_id` is
 * `nullable=False` and the only public endpoint is vehicle-scoped, so a contact
 * form has to name a vehicle or there is nothing to store the enquiry against.
 *
 * The options are therefore the actual published inventory, labelled with the same
 * `vehicleTitle` the grid and the detail page use, so a visitor reads the same
 * words in the select that they would read on the car itself. Free text here would
 * be unmatchable against real slugs and would have to be resolved by guessing.
 *
 * When the inventory is empty the page renders no form at all - see
 * `contact-page.tsx`, which is why this component is never handed an empty list.
 *
 * ---------------------------------------------------------------------------
 * "Phone / WhatsApp" is one field, named `customer_phone`
 * ---------------------------------------------------------------------------
 * The visitor picks the channel; the business needs the number either way. The
 * backend's `EnquiryWrite` has a single `customer_phone` field and validates it
 * against a dialling pattern, so two separate inputs would mean deciding in the
 * browser which one to send and discarding the other. One field, one stored value,
 * and a label that says both are welcome.
 */

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  submitContactEnquiryAction,
  type ContactEnquiryState,
} from "@/app/actions/contact-enquiries";
import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  EMAIL_MAX,
  MESSAGE_MAX,
  MESSAGE_MIN,
  NAME_MAX,
  PHONE_MAX,
  PHONE_MIN,
} from "@/features/vehicles/lib/enquiry-form";

/** A vehicle the visitor can enquire about. Serializable, so it crosses the boundary. */
export type ContactEnquiryVehicle = {
  /** Posted as `vehicle_slug` and resolved by the backend, never trusted as an id. */
  slug: string;
  /** Shown in the option, via the same `vehicleTitle` the inventory uses. */
  title: string;
};

export function ContactEnquiryForm({ vehicles }: { vehicles: ContactEnquiryVehicle[] }) {
  const [state, formAction] = useActionState<ContactEnquiryState, FormData>(
    submitContactEnquiryAction,
    null,
  );

  // Narrowed once, as `enquiry-form.tsx` does, so each control reads
  // `failure?.errors?.customer_name` rather than repeating the discriminant.
  const failure = state?.ok === false ? state : null;
  const success = state?.ok === true ? state : null;

  // A success replaces the form. Someone who has been told "thank you" and left
  // looking at five empty boxes is being asked a second time whether they want to
  // make an enquiry, and the obvious second answer is no.
  if (success) {
    return (
      <div aria-labelledby="contact-form-heading" className="flex flex-col gap-4">
        <h3 id="contact-form-heading" className="text-label text-fg-muted">
          Send an enquiry
        </h3>
        <FormMessage tone="success">{success.message}</FormMessage>
        <p className="text-body-sm text-fg-muted">
          Not the vehicle you had in mind? Browse the{" "}
          <Link
            href="/inventory"
            className="text-fg-accent underline underline-offset-4"
          >
            current inventory
          </Link>{" "}
          or ask us to source one.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} aria-labelledby="contact-form-heading" className="flex flex-col gap-5">
      <h3 id="contact-form-heading" className="text-label text-fg-muted">
        Send an enquiry
      </h3>

      {/* `role="alert"` and `aria-live` come from `FormMessage`. */}
      {failure !== null ? <FormMessage tone="danger">{failure.message}</FormMessage> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required error={failure?.errors?.customer_name}>
          <Input
            name="customer_name"
            type="text"
            // `autoComplete="name"` so a returning visitor is not asked to retype a
            // name the browser already knows.
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
        label="Phone / WhatsApp"
        required
        error={failure?.errors?.customer_phone}
        help="Either is fine - whichever you would rather we used to reply."
      >
        <Input
          name="customer_phone"
          type="tel"
          // `tel` rather than a pattern-guarded `text`: it is what makes a mobile
          // keyboard offer digits and a plus key. The pattern is still enforced
          // server-side by the backend's `customer_phone` validator.
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

      {/*
        The vehicle select.

        `required` on the native control rather than only in `aria`, so the browser
        refuses an empty submission before it costs a round trip - and the server
        action checks it again, because a client-side `required` is a convenience
        and not a boundary.

        `defaultValue` echoes the chosen slug back after a rejection, which is the
        reason the visitor does not lose their pick along with the rest of the form.
      */}
      <Field
        label="Vehicle of interest"
        required
        error={failure?.errors?.vehicle_slug}
        help="Every published vehicle in our inventory. If you want something that is not listed, use the sourcing link at the end of this page."
      >
        <Select
          name="vehicle_slug"
          required
          invalid={Boolean(failure?.errors?.vehicle_slug)}
          defaultValue={failure?.submittedSlug ?? ""}
        >
          <option value="">Select a vehicle</option>
          {vehicles.map((vehicle) => (
            <option key={vehicle.slug} value={vehicle.slug}>
              {vehicle.title}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Message" required error={failure?.errors?.message}>
        <Textarea
          name="message"
          rows={5}
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
 * has to be a child of the `<form>`. `loading` also sets `disabled`, which is what
 * stops a double-tap filing two enquiries - and the unique constraint on
 * `(vehicle_id, customer_email)` would turn the second into a conflict the visitor
 * did nothing to deserve.
 */
function SubmitEnquiryButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" loading={pending} loadingText="Sending" className="self-start">
      Send enquiry
    </Button>
  );
}