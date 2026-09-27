"use client";

import { startTransition, useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";

import {
  deleteImageAction,
  reorderImagesAction,
  setPrimaryImageAction,
} from "@/app/staff/actions/images";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Star, Trash, Upload } from "@/components/icons";
import { Cluster, Stack } from "@/components/ui/stack";
import { Field, FormMessage } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";
import { MAX_FILES_PER_UPLOAD, MAX_IMAGES_PER_VEHICLE } from "@/features/staff/lib/image-limits";
import { imageProblemMessage, type ImageUploadProblem } from "@/features/staff/lib/image-upload-feedback";
import type { ImageActionState } from "@/features/staff/lib/action-state";
import type { StaffVehicleImage } from "@/types/staff";

/** What the last upload attempt did, decoded from the editor's query string. */
export interface ImageUploadOutcome {
  /** How many photographs were added, or `null` if the last attempt added none. */
  added: number | null;
  /** Why the last attempt failed, or `null` if it did not fail. */
  problem: ImageUploadProblem | null;
  /** One-based position for `missing_alt`, or `null` when not applicable. */
  position: number | null;
}

/**
 * The photograph manager for one vehicle: upload, order, promote, delete.
 *
 * ---------------------------------------------------------------------------
 * Why alt text is a required field per photograph
 * ---------------------------------------------------------------------------
 * Because the backend refuses the whole upload if any description is missing, and
 * because a photograph with no alt text is invisible to a screen reader. The
 * alternative - generating a caption from the vehicle's name - would be a claim
 * about an image nobody looked at, and it would be wrong the moment somebody
 * uploaded a photograph of the odometer.
 *
 * The `required` attribute is a UX affordance. The backend re-checks it, and that
 * check is the one that counts.
 *
 * ---------------------------------------------------------------------------
 * Why ordering is buttons and not drag-and-drop
 * ---------------------------------------------------------------------------
 * A drag-and-drop list needs a pointer-event drag system, a keyboard-accessible
 * equivalent, and a live region announcing each move, before it is usable by
 * anyone who is not using a mouse. Two arrow buttons per row work immediately for
 * everybody and need no explanation, and for a gallery capped at thirty images
 * they are not slower in any way that matters.
 *
 * The whole list is submitted rather than a move instruction, because that is the
 * backend's contract - it rejects a list that repeats or omits an id, so a gallery
 * cannot be left half-reordered - and because a move instruction is ambiguous the
 * moment two staff members reorder the same vehicle at once.
 *
 * ---------------------------------------------------------------------------
 * Why the local order is state and not a DOM swap
 * ---------------------------------------------------------------------------
 * Because the order has to be visible while it is being changed. The list is held
 * in state, re-synced from the server's answer whenever the route revalidates, and
 * the hidden inputs render in that order so a submit posts exactly what is on
 * screen. Holding the order in the DOM and swapping values would post the right
 * thing while showing the wrong thing.
 */
export function ImageManager({
  vehicleId,
  images,
  outcome,
}: {
  vehicleId: string;
  images: StaffVehicleImage[];
  outcome: ImageUploadOutcome;
}) {
  return (
    <div className="flex flex-col gap-8">
      <UploadSection
        vehicleId={vehicleId}
        existingCount={images.length}
        outcome={outcome}
      />

      <hr className="border-line" />

      <OrderSection vehicleId={vehicleId} images={images} />
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Upload
 * ---------------------------------------------------------------------- */

/**
 * The upload form, and the outcome of the last attempt.
 *
 * A plain HTML post to a Route Handler rather than a Server Action, because Next
 * caps an action's raw request body at 1 MB and this endpoint accepts up to a
 * hundred megabytes. A `<form action={url}>` is also a better uploader than
 * anything reimplemented in a `fetch`: the browser shows its own progress, and it
 * works before the JavaScript bundle has loaded.
 *
 * The consequence is that the outcome arrives by redirect rather than through
 * `useActionState`, so it is decoded from the URL and passed in by the page. That
 * is not a worse arrangement: after any failure a browser cannot repopulate a file
 * input anyway, so there is no version of this where the staff member keeps their
 * selection, and therefore no version that loses something by re-rendering.
 */
function UploadSection({
  vehicleId,
  existingCount,
  outcome,
}: {
  vehicleId: string;
  existingCount: number;
  outcome: ImageUploadOutcome;
}) {
  const remaining = MAX_IMAGES_PER_VEHICLE - existingCount;
  const atCapacity = remaining <= 0;

  /*
    Why this exists alongside `useFormStatus`
    -----------------------------------------
    The button below reads the form's `pending` state through `useFormStatus`, which
    looked like the whole answer and is not.

    `useFormStatus` reports the state of a *React* form submission. In React 19 the
    pending state is pushed through `HostTransitionContext`, and the only thing that
    pushes a pending value is `startHostTransition` - which the form-submit handler
    calls on exactly two conditions: the form's `action` is a **function**, or a
    transition-scoped handler has already prevented the default.

    This form's `action` is a **string** (`/staff/vehicles/{id}/images`), because a
    native post is the only way a hundred megabytes of multipart body gets past
    Next's 1 MB Server Action cap. For a string action React intercepts nothing: the
    browser performs the navigation itself, `startHostTransition` is never reached,
    and `useFormStatus().pending` stays `false` for the lifetime of the page. The
    button would therefore never disable, and a second click would post a second
    independent upload - which is not a duplicate *submission* to the server, it is
    a second set of files appended to the gallery.

    So the pending state is set from the `submit` event instead, which the browser
    fires for any submission whether React is involved or not. React flushes the
    state update before the browser begins the upload - the update is scheduled
    during event dispatch, and the default action runs after dispatch completes - so
    the button is already disabled by the time any bytes are sent.
  */
  const [submitting, setSubmitting] = useState(false);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading
        level={3}
        title="Add photographs"
        description={`Up to ${MAX_FILES_PER_UPLOAD} at a time, ${MAX_IMAGES_PER_VEHICLE} per vehicle. Every photograph needs a description.`}
      />

      {/*
        Both messages sit above the form, not below it. Each reports something that
        happened on a submission which has already navigated away, so the eye
        arrives at the top of this section first - and an error the reader has to
        scroll down to find is an error half the time.
      */}
      {outcome.added !== null ? (
        <FormMessage tone="success">
          {outcome.added === 1 ? "1 photograph added." : `${outcome.added} photographs added.`}
        </FormMessage>
      ) : null}

      {outcome.problem !== null ? (
        <FormMessage tone="danger">
          {imageProblemMessage(outcome.problem, outcome.position)}
        </FormMessage>
      ) : null}

      {atCapacity ? (
        <FormMessage tone="warning">
          This vehicle already has the maximum of {MAX_IMAGES_PER_VEHICLE} photographs.
          Remove one to add another.
        </FormMessage>
      ) : null}

      {/*
        `encType` is written out even though a `File` input implies it. The
        attribute is what turns this into a multipart request, and relying on the
        implication is how a form ends up posting
        `application/x-www-form-urlencoded` with a filename in it and an empty body
        at the other end.
      */}
      <form
        action={`/staff/vehicles/${encodeURIComponent(vehicleId)}/images`}
        method="post"
        encType="multipart/form-data"
        onSubmit={() => setSubmitting(true)}
        className="flex flex-col gap-4"
      >
        {/*
          The count the editor rendered, so the handler can refuse an upload that
          would exceed the per-vehicle cap before a hundred megabytes crosses the
          network. The backend enforces the real cap; this is a fast-fail, not a
          control.
        */}
        <input type="hidden" name="existing_count" value={existingCount} />

        <UploadFields disabled={atCapacity} />

        <div>
          <UploadButton disabled={atCapacity} submitting={submitting} />
        </div>
      </form>
    </section>
  );
}

/**
 * The file input, plus one description field per chosen file.
 *
 * Both live in one component because the number of description fields has to match
 * the number of files, and that is a relationship between two pieces of DOM. A ref
 * shared between siblings would work too, and would be one more thing to keep
 * correct.
 *
 * Only the *names* of the selected files are held in state. The `File` objects stay
 * in the input, which is what the form submission reads - so there is no second
 * copy of a hundred megabytes in React state, and nothing that can fall out of step
 * with the input before the submit.
 */
function UploadFields({ disabled }: { disabled: boolean }) {
  const [names, setNames] = useState<string[]>([]);

  return (
    <Stack gap="sm">
      <Field
        label="Photographs"
        help="JPEG, PNG or WebP. Files are re-encoded on upload and stored without any EXIF data."
      >
        {/*
          A raw `input`, not the `Input` component. `Input` is a text field, and
          what it is actually for is a single-line string; a file input needs
          `multiple`, `accept` and its own focus ring, and reusing the component
          here would mean overriding most of what it does.
        */}
        <input
          type="file"
          name="images"
          multiple
          disabled={disabled}
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setNames(Array.from(event.currentTarget.files ?? []).map((file) => file.name))}
          className="block w-full text-body-sm text-fg-secondary file:mr-3 file:rounded-sm file:border file:border-line-control file:bg-sunken file:px-3 file:py-2 file:text-body-sm file:font-medium file:text-fg hover:file:bg-page"
        />
      </Field>

      {names.length === 0 ? null : (
        <Surface variant="sunken" className="flex flex-col gap-3 p-4">
          <p className="text-body-sm font-medium text-fg">Descriptions</p>

          {/*
            Keyed on the file name and the position, not on the index alone. Two
            different selections both starting at index 0 would otherwise reuse the
            same DOM and carry the first selection's typed text into the second -
            which is worse here than usual, because a description that silently
            changes is a description describing the wrong photograph.
          */}
          {names.map((name, index) => (
            <Field
              key={`${name}-${index}`}
              label={`Description for photograph ${index + 1}`}
              help={name}
              required
            >
              <Input name="alts" required placeholder="Front three-quarter view, driver side" />
            </Field>
          ))}
        </Surface>
      )}
    </Stack>
  );
}

/**
 * The upload submit button.
 *
 * Two pending sources, deliberately combined rather than one chosen. `pending` is
 * the form status React reports, and it is the only one that can ever be true if
 * this form is ever given a function action; `submitting` is the browser's own
 * submit event, and for the string action this form uses today it is the only one
 * that fires. `||` means the button is disabled whenever either says so, and
 * neither source has to be trusted to be sufficient.
 *
 * `Button` resolves `disabled={disabled || loading}` and sets `aria-busy` itself, so
 * disabling the button here is what both prevents the second click and announces the
 * wait to assistive technology.
 *
 * No progress percentage is shown, and none should be. The browser's own upload
 * progress is the accurate one; anything this component invented about a
 * `multipart` body would be a guess.
 */
function UploadButton({ disabled, submitting }: { disabled: boolean; submitting: boolean }) {
  const { pending } = useFormStatus();
  const busy = pending || submitting;

  return (
    <Button type="submit" loading={busy} loadingText="Uploading" disabled={disabled || busy}>
      <Upload aria-hidden="true" className="size-4" />
      Upload
    </Button>
  );
}

/* -------------------------------------------------------------------------
 * Ordering
 * ---------------------------------------------------------------------- */

function OrderSection({
  vehicleId,
  images,
}: {
  vehicleId: string;
  images: StaffVehicleImage[];
}) {
  const [state, formAction] = useActionState<ImageActionState, FormData>(
    async (previous, form) => reorderImagesAction(vehicleId, previous, form),
    null,
  );

  // The order as shown, which is not necessarily the order on the server: moving a
  // row changes this and nothing else until the form is saved.
  const [order, setOrder] = useState(images);

  // Adopt the server's order whenever it changes - after a save, a promote, a
  // delete, or a revalidation from elsewhere.
  //
  // Done during render rather than in an effect, and this is the documented
  // pattern for it. An effect here would be flagged for good reason: it renders
  // once with the stale order, then again with the fresh one, so every revalidation
  // would visibly re-lay-out the gallery. Comparing against the previous props
  // during render means the new order is used by the very same render, and React
  // discards the in-progress result rather than committing a frame nobody sees.
  //
  // The identity of the `images` prop is the signal, and it is a good one: it is
  // stable across this component's own re-renders, and changes exactly when the
  // server sends a new answer. Local reordering does not touch it, so an
  // unrelated render cannot undo a move in progress.
  const [lastImages, setLastImages] = useState(images);
  if (images !== lastImages) {
    setLastImages(images);
    setOrder(images);
  }

  const dirty =
    order.length !== images.length ||
    order.some((image, index) => image.id !== images[index]?.id);

  return (
    <section className="flex flex-col gap-4">
      <SectionHeading
        level={3}
        title="Order"
        description="The first photograph leads the listing, and is the one shown on the inventory card."
      />

      {images.length === 0 ? (
        <p className="text-body-sm text-fg-muted">
          No photographs yet. This vehicle shows a placeholder on the public site
          until one is added.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          {/*
            Only the failure is rendered, and `ok` is what says which is which. A
            success is not announced here because a saved order is already
            obvious: the "unsaved changes" note underneath has gone.
          */}
          {state?.ok === false ? (
            <FormMessage tone="danger">{state.message}</FormMessage>
          ) : null}

          <ul className="flex flex-col gap-3">
            {order.map((image, index) => (
              <ImageRow
                key={image.id}
                vehicleId={vehicleId}
                image={image}
                index={index}
                total={order.length}
                onMove={(direction) =>
                  setOrder((current) => {
                    const target = direction === "up" ? index - 1 : index + 1;
                    if (target < 0 || target >= current.length) return current;

                    const next = [...current];
                    const [moved] = next.splice(index, 1);
                    if (moved) next.splice(target, 0, moved);
                    return next;
                  })
                }
              />
            ))}
          </ul>

          <Cluster gap="sm">
            <Button type="submit" variant="secondary" disabled={!dirty}>
              Save order
            </Button>

            {/*
              Said out loud, because a disabled button with no explanation reads as
              a broken control. The state is otherwise invisible: the list looks
              the same whether or not it differs from the server.
            */}
            {dirty ? (
              <span className="text-body-sm text-fg-muted">This order has unsaved changes.</span>
            ) : null}
          </Cluster>
        </form>
      )}
    </section>
  );
}

/**
 * One photograph.
 *
 * The id is in a hidden input, and the inputs render in the order the list is
 * displayed - so submitting posts exactly what is on screen, with no separate
 * "current order" array to keep in step with the visible one.
 */
function ImageRow({
  vehicleId,
  image,
  index,
  total,
  onMove,
}: {
  vehicleId: string;
  image: StaffVehicleImage;
  index: number;
  total: number;
  onMove: (direction: "up" | "down") => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <li className="flex items-center gap-3">
      <Image
        src={image.src}
        // The description the staff member wrote. `alt` rather than an empty
        // string: this is a real photograph of a real vehicle, and the text is
        // already here because the backend refuses to store an image without one.
        alt={image.alt}
        width={image.width}
        height={image.height}
        // The width and height are what the API measured on upload, and passing
        // them is what lets the optimiser reserve the exact box - so the list does
        // not reflow as thumbnails arrive. The fixed `size-14` alongside crops to
        // a square without changing what is reserved.
        className="size-14 shrink-0 rounded-sm object-cover"
      />

      <input type="hidden" name="image_id" value={image.id} />

      <span className="min-w-0 flex-1 truncate text-body-sm text-fg-secondary">
        {image.alt}
      </span>

      {index === 0 ? <Badge tone="accent">Lead</Badge> : null}

      <Cluster gap="xs">
        {/*
          Disabled rather than hidden at the ends. A control that appears and
          disappears moves every row below it as it is used, so the gallery jumps
          under the pointer exactly when somebody is trying to aim at a row.
        */}
        <IconButton
          type="button"
          icon={ChevronUp}
          label={`Move "${image.alt}" up`}
          variant="ghost"
          size="sm"
          disabled={index === 0}
          onClick={() => onMove("up")}
        />

        <IconButton
          type="button"
          icon={ChevronDown}
          label={`Move "${image.alt}" down`}
          variant="ghost"
          size="sm"
          disabled={index === total - 1}
          onClick={() => onMove("down")}
        />

        {/*
          "Make lead" rather than a position picker. It is the only reordering
          anybody performs often, and it maps exactly onto the backend's own
          primary-image route, which shifts the rest down while preserving their
          relative order.
        */}
        {index === 0 ? null : (
          <IconButton
            type="button"
            icon={Star}
            label={`Make "${image.alt}" the lead photograph`}
            variant="ghost"
            size="sm"
            onClick={() => startTransition(() => setPrimaryImageAction(vehicleId, image.id))}
          />
        )}

        {/*
          Two steps, inline. A dialog is the right answer for a destructive action,
          and a photograph is a weaker case than a vehicle: the row it came from is
          still here, the file is gone for good, and the mistake is obvious and
          immediate rather than discovered later. A confirm button beside the row
          stops the accident, which is the whole purpose of the confirmation.
        */}
        {confirmingDelete ? (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => startTransition(() => deleteImageAction(vehicleId, image.id))}
          >
            Delete
          </Button>
        ) : (
          <IconButton
            type="button"
            icon={Trash}
            label={`Delete "${image.alt}"`}
            variant="ghost"
            size="sm"
            onClick={() => setConfirmingDelete(true)}
          />
        )}
      </Cluster>
    </li>
  );
}
