import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { getStaffVehicle } from "@/lib/api/admin-vehicles";
import type { StaffVehicleRecord } from "@/lib/api/admin-vehicles";
import { ApiError } from "@/lib/api/errors";
import { archiveVehicleAction, restoreVehicleAction, updateVehicleAction } from "@/app/staff/actions/vehicles";
import { requireStaff } from "@/lib/staff/dal";
import { parseStaffVehicle } from "@/features/staff/lib/staff-schema";
import { vehicleFormValues } from "@/features/staff/lib/vehicle-form";
import { MAX_FILES_PER_UPLOAD } from "@/features/staff/lib/image-limits";
import {
  IMAGE_ADDED_PARAM,
  IMAGE_POSITION_PARAM,
  IMAGE_PROBLEM_PARAM,
  parseImagePosition,
  parseImageProblem,
} from "@/features/staff/lib/image-upload-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cluster, Stack } from "@/components/ui/stack";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";
import { ImageManager, type ImageUploadOutcome } from "@/features/staff/components/image-manager";
import { VehicleForm } from "@/features/staff/components/vehicle-form";
import { STAFF_VEHICLES } from "@/features/staff/lib/routes";
import type { VehicleAvailability } from "@/types/staff";

/**
 * The vehicle editor: details, photographs, and the archive control.
 *
 * ---------------------------------------------------------------------------
 * Why this is one page rather than tabs or sub-routes
 * ---------------------------------------------------------------------------
 * Because a vehicle is one record and the three things on this page edit it. A
 * staff member adding photographs has the description open, and the archive button
 * is the third control rather than three navigations away - which matters most for
 * the control whose absence changes whether a vehicle is publicly visible.
 *
 * The photographs are still their own routes on the API, with their own upload
 * form. The layout here is a decision about the *screen*, not about the contract.
 *
 * ---------------------------------------------------------------------------
 * Why the archive control is here and labelled "Archive"
 * ---------------------------------------------------------------------------
 * Because there is no delete. The backend has no `DELETE /vehicles/{id}` and this
 * interface does not pretend otherwise: archiving removes a vehicle from sale and
 * keeps the record, its photographs and its history, and restoring puts it back.
 * A button labelled "Delete" on an action that can be undone in one click would
 * be a lie about what the click does, and somebody would eventually believe it.
 */
export const metadata: Metadata = {
  title: "Edit vehicle",
};

export default async function EditVehiclePage({
  params,
  searchParams,
}: PageProps<"/staff/vehicles/[vehicleId]">) {
  await requireStaff();

  const { vehicleId } = await params;

  // A 404 is a 404 here, and it has to be *caught* to become one.
  //
  // `getStaffVehicle` throws an `ApiError` on any non-2xx response - it does not
  // return `null` - so the `record === null` check below used to be unreachable
  // and a deleted vehicle rendered the error boundary: an HTTP 500 "Something went
  // wrong" for what is a fact about the request. That is the same class of bug as
  // the action-prop fix above: unreachable at build time, obvious the moment a
  // vehicle with that id stops existing.
  //
  // Only 404 is converted. A 401 is *not* a 404: it means the session died between
  // the layout's check and this fetch, and reporting "not found" would send a
  // signed-in staff member looking for a vehicle that exists. Everything else
  // propagates to the error boundary, which says the request failed.
  let record: StaffVehicleRecord | null = null;
  try {
    record = await getStaffVehicle(vehicleId);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }

  // "No such vehicle" is a fact about the request, not a failure of the page, so
  // it renders this segment's `not-found.tsx` and carries a 404 status.
  if (record === null) notFound();

  const parsed = parseStaffVehicle(record);
  if (!parsed.ok) {
    // A vehicle the API returned but this frontend cannot read. Surfaced as an
    // error rather than an empty form, because an editor pre-filled from nothing
    // and then saved would overwrite the record with blanks.
    throw new Error(parsed.error);
  }

  const vehicle = parsed.value;

  // The last upload's outcome, decoded from the query string. A Route Handler
  // cannot return a message into a component - it redirects, and this is where
  // the redirect lands - so the query is the only channel it has. `parseImageProblem`
  // and `parseImagePosition` are membership and range checks, so a stale or
  // hand-edited URL renders nothing rather than an arbitrary code.
  const query = await searchParams;
  const uploadOutcome: ImageUploadOutcome = {
    added: parseAddedCount(query[IMAGE_ADDED_PARAM]),
    problem: parseImageProblem(firstValue(query[IMAGE_PROBLEM_PARAM])),
    position: parseImagePosition(firstValue(query[IMAGE_POSITION_PARAM])),
  };

  return (
    <Container className="py-10">
      {/*
        Breadcrumb rather than a back link. "All vehicles" is a real destination a
        staff member can predict, and putting the vehicle's name above the form
        means they can confirm they are editing the right one - which is the one
        thing a form full of similar-looking values makes easy to get wrong.
      */}
      <nav aria-label="Breadcrumb" className="mb-4">
        <Link
          href={STAFF_VEHICLES}
          className="text-body-sm text-fg-muted underline underline-offset-4 hover:text-fg"
        >
          All vehicles
        </Link>
      </nav>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Cluster gap="sm">
            <h1 className="text-display-sm text-fg">
              {vehicle.make} {vehicle.model}
            </h1>

            {/*
              Archived is its own badge because it answers a different question
              from the availability state. "Sold" is a historical record; "Archived"
              is what removes the vehicle from the public site right now. One column
              cannot carry both without one of them being ambiguous.
            */}
            {vehicle.archivedAt ? <Badge tone="danger">Archived</Badge> : null}

            <Badge tone={STATUS_TONE[vehicle.status]}>{LABEL[vehicle.status]}</Badge>
          </Cluster>

          <p className="mt-1 text-body-sm text-fg-muted">
            {vehicle.year}
            {vehicle.variant ? ` · ${vehicle.variant}` : ""}
            {" · /inventory/"}
            {vehicle.slug}
          </p>
        </div>

        {/*
          Archive and restore are forms posting to server actions, not links, for
          the same reason sign-out is: a GET that changes whether a vehicle is
          publicly visible could be triggered by a prefetch or a crawler.

          The action is *bound* to the id rather than reading it from a hidden
          input. A bound argument is captured in the server reference itself, so
          there is no field a form can alter to point the archive at a different
          vehicle - and one fewer thing to forget when the form is edited.
        */}
        <form action={(vehicle.archivedAt ? restoreVehicleAction : archiveVehicleAction).bind(null, vehicle.id)}>
          <Button type="submit" variant={vehicle.archivedAt ? "primary" : "secondary"}>
            {vehicle.archivedAt ? "Return to sale" : "Archive"}
          </Button>
        </form>
      </div>

      {/*
        Archived vehicles stay fully editable, and the backend keeps them that way.
        The most common reason to open an archived vehicle is to fix whatever made
        it unsellable, and a read-only form would mean fixing it in a database
        console instead.
      */}
      {vehicle.archivedAt ? (
        <div className="mb-8">
          <Surface variant="sunken" className="p-4">
            <p className="text-body-sm text-fg-secondary">
              This vehicle was archived on{" "}
              {new Date(vehicle.archivedAt).toLocaleDateString("en-AE", {
                dateStyle: "long",
              })}
              . It is hidden from the public site but can still be edited, and
              &ldquo;Return to sale&rdquo; puts it back.
            </p>
          </Surface>
        </div>
      ) : null}

      <div className="flex flex-col gap-10">
        <section className="flex flex-col gap-4">
          <SectionHeading level={2} title="Details" />

          <Surface className="max-w-3xl p-6">
            <VehicleForm
              // The vehicle id is bound onto the action rather than the action
              // being wrapped in a closure.
              //
              // `VehicleForm` is a Client Component, and a function created inside
              // a Server Component is not serialisable across that boundary. Passing
              // `async (previous, form) => updateVehicleAction(vehicle.id, previous, form)`
              // therefore fails at render time with "Functions cannot be passed
              // directly to Client Components" - and because it is a runtime-only
              // RSC serialisation error, the type checker, the linter, the unit
              // tests and the production build all pass while the page 500s.
              //
              // `.bind()` on a `"use server"` export produces a genuine server
              // reference with the extra argument captured inside it, which is the
              // supported way to do this and exactly what the archive form above
              // already does with `archiveVehicleAction.bind(null, vehicle.id)`.
              action={updateVehicleAction.bind(null, vehicle.id)}
              initialValues={vehicleFormValues(vehicle)}
              submitLabel="Save changes"
              pendingLabel="Saving"
            />
          </Surface>
        </section>

        <section className="flex flex-col gap-4">
          <Stack gap="xs">
            <SectionHeading level={2} title="Photographs" />
          </Stack>

          <ImageManager
            vehicleId={vehicle.id}
            images={vehicle.images}
            outcome={uploadOutcome}
          />
        </section>
      </div>
    </Container>
  );
}

/** Badge tone per availability, so the state is readable without reading the word. */
const STATUS_TONE: Record<VehicleAvailability, "success" | "warning" | "neutral"> = {
  available: "success",
  reserved: "warning",
  sold: "neutral",
};

/** Availability states as a staff member reads them, not as the API stores them. */
const LABEL: Record<VehicleAvailability, string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
};

/**
 * A repeated query parameter collapses to an array, so a hand-built URL with two
 * `images_added` values would otherwise reach a `Number()` that accepted the first
 * and ignored the rest. Taking the first entry is enough: this parameter is written
 * by one redirect, and the only thing a duplicate can do is confuse a parse.
 */
function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/**
 * How many photographs the last upload added, or `null`.
 *
 * Bounded on both sides rather than trusted. The value came from a redirect this
 * server produced, but the *page* is reachable by any URL - and an unbounded
 * number here would be rendered as "2147483647 photographs added.", which is a
 * claim about the database that nothing in the code would have checked.
 */
function parseAddedCount(value: string | string[] | undefined): number | null {
  const raw = firstValue(value);
  if (raw === null) return null;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1 || parsed > MAX_FILES_PER_UPLOAD) return null;

  return parsed;
}
