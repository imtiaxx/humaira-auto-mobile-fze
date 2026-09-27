"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field, FormMessage } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Stack, Cluster } from "@/components/ui/stack";
import { IconButton } from "@/components/ui/icon-button";
import { Plus, Trash } from "@/components/icons";
import { AVAILABILITY_OPTIONS, suggestSlug, type VehicleFormValues } from "@/features/staff/lib/vehicle-form";
import type { VehicleFormState } from "@/features/staff/lib/action-state";

/**
 * The vehicle form, used for both adding and editing.
 *
 * ---------------------------------------------------------------------------
 * One form, two jobs
 * ---------------------------------------------------------------------------
 * Create and update take the same fields, and the backend's schemas say so
 * explicitly - `VehicleUpdate` is `VehicleWriteBase` with nothing added, and every
 * field is required on both. A second, near-identical form for editing would be
 * two places for a rule to change and one of them would be wrong within a month.
 *
 * So the action is a prop. The page that knows which action to call passes it in,
 * and this component is the same markup either way.
 *
 * ---------------------------------------------------------------------------
 * Why the inputs are uncontrolled
 * ---------------------------------------------------------------------------
 * Because the authoritative copy of what was typed is on the server. After a
 * failed save, `useActionState` holds every submitted value, and the inputs render
 * from that - `defaultValue` rather than `value`, so React does not fight the
 * browser over a field the staff member may be mid-way through retyping.
 *
 * The one piece of state this component does own is the feature rows, because
 * adding and removing rows is genuinely local interaction with no server meaning.
 * It is re-synced from the action's return value on every failure, which is what
 * stops a server-side normalisation (a slug lower-cased, a VIN upper-cased) from
 * being silently discarded on the next submit.
 *
 * ---------------------------------------------------------------------------
 * Why there is no currency control
 * ---------------------------------------------------------------------------
 * There is one currency. The backend accepts the field and refuses every value
 * except `USD` precisely so that a client posting something else fails loudly, and
 * a dropdown offering one option is a lie about choice. The value is sent as a
 * constant from `parseVehicleForm`.
 */
export function VehicleForm({
  action,
  initialValues,
  submitLabel,
  pendingLabel,
}: {
  action: (previous: VehicleFormState, form: FormData) => Promise<VehicleFormState>;
  initialValues: VehicleFormValues;
  submitLabel: string;
  pendingLabel: string;
}) {
  // `null`, not `undefined`: the initial state is a real "nothing has happened
  // yet" value, and `useActionState` requires the initial value to be in the
  // state's type. Success returns a value too, so an `undefined` initial could not
  // be told apart from a successful save.
  const [state, formAction] = useActionState<VehicleFormState, FormData>(action, null);
  const [rows, setRows] = useState(initialValues.featureRows);
  const formRef = useRef<HTMLFormElement>(null);

  // Only a failure carries values back, so only a failure can change the rows.
  // A success means the server revalidated the page and the editor re-rendered
  // from its own data - the component this is inside is replaced, not updated.
  const failure = state?.ok === false ? state : null;

  // Re-sync the rows when a new submission comes back, during render rather than
  // in an effect. An effect would render once with the previous rows and again with
  // the new ones, so a rejected save would visibly rebuild the feature list after
  // the fact; adjusting during render means one render with the right rows, and
  // React discards the intermediate result rather than committing it.
  //
  // The identity of `failure` is the signal: the action returns a fresh object on
  // every failure and `null` on success, so a new object always means a new
  // submission, and equal-by-value is still new.
  const [lastFailure, setLastFailure] = useState(failure);
  if (failure !== lastFailure) {
    setLastFailure(failure);
    if (failure?.values) setRows(failure.values.featureRows);
  }

  const values = failure?.values ?? initialValues;
  const errors = failure?.errors ?? {};

  /**
   * Fills the slug field from the make, model and variant.
   *
   * Reads the current values out of the form element rather than from React
   * state, because every input here is uncontrolled - the form is the only thing
   * that reliably knows what is in a field at the moment a button is pressed.
   * Writing back through the same element keeps the uncontrolled design intact;
   * introducing state for one field would mean re-rendering the whole form to
   * change a single input.
   *
   * Defined here rather than at module scope because it closes over `formRef`.
   */
  function fillSlugFromNames(): void {
    const form = formRef.current;
    if (!form) return;

    const data = new FormData(form);
    const field = (name: string): string => {
      const value = data.get(name);
      return typeof value === "string" ? value : "";
    };

    const suggestion = suggestSlug({
      make: field("make"),
      model: field("model"),
      variant: field("variant"),
    });

    const input = form.elements.namedItem("slug");
    // A name collision would make this an `RadioNodeList`, and assigning `.value`
    // to one of those sets nothing. The `instanceof` is the cheap guard.
    if (suggestion !== "" && input instanceof HTMLInputElement) {
      input.value = suggestion;
    }
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-8">
      {/*
        Success above failure, so a confirmation never sits below an error from
        the *previous* attempt. Both are rendered from the same state, which can
        only be one of them, so they cannot both appear.
      */}
      {state?.ok === true ? <FormMessage tone="success">{state.message}</FormMessage> : null}

      {failure !== null ? <FormMessage tone="danger">{failure.message}</FormMessage> : null}

      <Fieldset legend="Identification">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Make" required error={errors.make}>
            <Input name="make" defaultValue={values.make} required invalid={Boolean(errors.make)} />
          </Field>

          <Field label="Model" required error={errors.model}>
            <Input name="model" defaultValue={values.model} required invalid={Boolean(errors.model)} />
          </Field>

          <Field
            label="Variant"
            help="Optional. For example, the trim level."
            error={errors.variant}
          >
            <Input name="variant" defaultValue={values.variant} invalid={Boolean(errors.variant)} />
          </Field>

          <Field
            label="Model year"
            required
            error={errors.year}
            help="Between 1900 and next year."
          >
            <Input
              name="year"
              type="number"
              inputMode="numeric"
              defaultValue={values.year}
              required
              invalid={Boolean(errors.year)}
            />
          </Field>
        </div>

        {/*
          The slug is a permanent public address, so it is edited explicitly and
          only *suggested* from the make and model. A slug derived from fields that
          get corrected later would break every link to the vehicle, and a button
          that fills it in is help where an automatic derivation would be a
          decision made on the staff member's behalf.
        */}
        <Field
          label="URL slug"
          required
          error={errors.slug}
          help="The public address for this vehicle. Lower case, words separated by hyphens."
        >
          <Cluster gap="sm" align="center">
            <Input
              name="slug"
              defaultValue={values.slug}
              required
              invalid={Boolean(errors.slug)}
              className="flex-1"
            />
            <Button type="button" variant="secondary" size="md" onClick={fillSlugFromNames}>
              Suggest
            </Button>
          </Cluster>
        </Field>
      </Fieldset>

      <Fieldset legend="Specification">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Body type" error={errors.body_type}>
            <Input name="body_type" defaultValue={values.body_type} invalid={Boolean(errors.body_type)} />
          </Field>

          <Field label="Transmission" error={errors.transmission}>
            <Input
              name="transmission"
              defaultValue={values.transmission}
              invalid={Boolean(errors.transmission)}
            />
          </Field>

          <Field label="Fuel" error={errors.fuel}>
            <Input name="fuel" defaultValue={values.fuel} invalid={Boolean(errors.fuel)} />
          </Field>

          <Field label="Colour" error={errors.colour}>
            <Input name="colour" defaultValue={values.colour} invalid={Boolean(errors.colour)} />
          </Field>

          <Field label="Odometer (km)" error={errors.mileage_km} help="Whole kilometres.">
            <Input
              name="mileage_km"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              defaultValue={values.mileage_km}
              invalid={Boolean(errors.mileage_km)}
            />
          </Field>

          <Field
            label="VIN"
            error={errors.vin}
            help="17 characters. Optional, but it is what identifies the vehicle."
          >
            <Input
              name="vin"
              // Not `maxLength`: a 16-character VIN is more useful to correct on
              // screen than to have silently truncated, and the error message
              // explains the real rule.
              defaultValue={values.vin}
              spellCheck={false}
              autoCapitalize="characters"
              invalid={Boolean(errors.vin)}
            />
          </Field>
        </div>
      </Fieldset>

      <Fieldset legend="Pricing and availability">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Price (USD)"
            error={errors.price}
            help="Leave blank for &quot;price on request&quot;."
          >
            <Input
              name="price"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              defaultValue={values.price}
              invalid={Boolean(errors.price)}
            />
          </Field>

          <Field label="Availability" required error={errors.status}>
            <Select name="status" defaultValue={values.status} required invalid={Boolean(errors.status)}>
              {AVAILABILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Location" error={errors.location}>
            <Input name="location" defaultValue={values.location} invalid={Boolean(errors.location)} />
          </Field>
        </div>
      </Fieldset>

      <Fieldset legend="Features" error={errors.features}>
        {/*
          One row per feature, as a pair of inputs rather than a free-text blob.
          The public page renders features as name/value specification rows, so a
          single "Air conditioning, alloys, tow bar" string would have to be split
          by a guess later - and the split is the kind of guess that puts a
          half-parsed row on a customer's screen.
        */}
        {rows.length === 0 ? (
          <p className="text-body-sm text-fg-muted">
            No features yet. Add the ones worth listing.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row, index) => (
              <li key={index} className="flex items-start gap-3">
                <Field label="Name" hideLabel error={errors[`feature_${index}`]}>
                  <Input
                    name="feature_name"
                    defaultValue={row.name}
                    placeholder="Tow bar"
                    invalid={Boolean(errors[`feature_${index}`])}
                  />
                </Field>

                <Field label="Value" hideLabel error={errors[`feature_${index}`]}>
                  <Input
                    name="feature_value"
                    defaultValue={row.value}
                    placeholder="Factory fitted"
                    invalid={Boolean(errors[`feature_${index}`])}
                  />
                </Field>

                <IconButton
                  type="button"
                  icon={Trash}
                  label={`Remove feature ${index + 1}`}
                  variant="ghost"
                  onClick={() =>
                    setRows((current) => current.filter((_, position) => position !== index))
                  }
                />
              </li>
            ))}
          </ul>
        )}

        <div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setRows((current) => [...current, { name: "", value: "" }])}
          >
            <Plus aria-hidden="true" className="size-4" />
            Add a feature
          </Button>
        </div>
      </Fieldset>

      <SaveButton label={submitLabel} pendingLabel={pendingLabel} />
    </form>
  );
}

/** A titled group of related fields. */
function Fieldset({
  legend,
  error,
  children,
}: {
  legend: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-4 border-0 p-0">
      <legend className="text-body font-semibold text-fg">{legend}</legend>
      {children}
      {error ? <FormMessage tone="danger">{error}</FormMessage> : null}
    </fieldset>
  );
}

/**
 * The submit button.
 *
 * A separate component because `useFormStatus` only reports the status of the form
 * it is rendered inside. `loading` disables the button, which is what stops a
 * second save being submitted while the first is in flight: two concurrent
 * `PATCH`es for the same vehicle would resolve in an arbitrary order and the
 * second would silently win, overwriting the first.
 */
function SaveButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <Stack gap="sm">
      <div>
        <Button type="submit" loading={pending} loadingText={pendingLabel}>
          {label}
        </Button>
      </div>
    </Stack>
  );
}
