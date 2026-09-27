import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getStaffVehiclePage } from "@/lib/api/admin-vehicles";
import { requireStaff } from "@/lib/staff/dal";
import { parseStaffVehicle } from "@/features/staff/lib/staff-schema";
import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import { Cluster } from "@/components/ui/stack";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/states";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";
import { STAFF_NEW_VEHICLE, STAFF_VEHICLES, staffVehicle } from "@/features/staff/lib/routes";
import type { StaffVehicle, VehicleAvailability } from "@/types/staff";

/**
 * The staff vehicle list, archived vehicles included.
 *
 * ---------------------------------------------------------------------------
 * Why this list includes archived vehicles
 * ---------------------------------------------------------------------------
 * Because the public list cannot. The public list hides them - that is the entire
 * effect of archiving - so this is the only place a withdrawn vehicle can be
 * seen, and the most common reason to look at one here is to restore it, or to
 * fix whatever made it unsellable.
 *
 * The consequence is that a vehicle can be in this list and not on the site, and
 * the status column says which. A staff member who archives something and cannot
 * find it again would reasonably conclude the archive had failed.
 *
 * ---------------------------------------------------------------------------
 * Pagination
 * ---------------------------------------------------------------------------
 * Real, because the backend caps a page at 100 and a dealer accumulates vehicles.
 * An earlier version of this file rendered the first hundred and a total, on the
 * reasoning that a pager with one page behind it "looks unfinished" - which is
 * exactly backwards. A control that is missing is invisible, and an inventory of
 * 200 vehicles in which 100 cannot be opened is a broken list, not a minimal one.
 *
 * The page number lives in the URL rather than in component state, so a page can be
 * linked, survives a refresh, and works with the browser's back button.
 */
export const metadata: Metadata = {
  title: "Vehicles",
};

/** Rows per page. Matches the backend's own cap, so nothing is silently truncated. */
const PAGE_SIZE = 100;

/**
 * One row's worth of data, after parsing.
 *
 * A tagged union rather than two parallel arrays or a nullable `vehicle`. The tag is
 * explicit, so the render below narrows on it and TypeScript rejects any future
 * attempt to read `.vehicle` off a row that has only an error.
 */
type ListRow =
  | { tag: "ok"; vehicle: StaffVehicle }
  | { tag: "unreadable"; id: string; error: string };

export default async function StaffVehiclesPage({
  searchParams,
}: PageProps<"/staff/vehicles">) {
  await requireStaff();

  const query = await searchParams;

  // Parsed rather than passed through. `page=abc` or `page=-1` would otherwise
  // reach the API, and the resulting behaviour - an error page, or a silent first
  // page - would depend on which of the two the backend happens to prefer.
  // Clamping here means a mangled URL behaves like page 1, which is what the
  // reader meant, and `page=0` cannot produce an empty list that looks like the
  // data has been lost.
  const page = clampPage(firstValue(query.page));

  const result = await getStaffVehiclePage({ page, page_size: PAGE_SIZE });

  // ---------------------------------------------------------------------------
  // The upper bound, which can only be known once the total is
  // ---------------------------------------------------------------------------
  // `clampPage` above can only normalise a value that is wrong on its own terms -
  // `abc`, `-1`, `0`. It cannot know that page 40 of a 2-page inventory is out of
  // range, because the total is not in the URL. So the second bound is applied here,
  // after the fetch, by redirecting to the last page that actually exists.
  //
  // Redirect rather than clamp in place, because the rows on screen belong to the
  // page that was *requested*. Clamping the number while keeping the empty result
  // would render "Page 2 of 2" above an empty list and a pager with no rows, which
  // reads as lost data rather than as a stale link. A redirect re-fetches the page
  // the URL now names, so what is displayed and what the address says agree.
  //
  // The `Number.isInteger` guard is not decoration. `getStaffVehiclePage` returns
  // `Page<T>`, which is a type assertion and not a runtime check, so a response
  // missing `total_pages` would otherwise make `Math.max(NaN, 1)` - and
  // `page > NaN` is false for every page, which is the one case that turns this
  // into a redirect loop. Falling back to 1 sends the reader to the start of the
  // list, which is wrong but harmless and, crucially, terminating.
  const totalPages = Number.isInteger(result.total_pages) ? result.total_pages : 0;
  const lastPage = Math.max(totalPages, 1);

  if (page > lastPage) {
    // Terminates by construction: the target is `lastPage`, and `lastPage` is
    // never greater than itself. An empty inventory clamps to 1, and page 1 is
    // never greater than 1, so the empty case redirects exactly once.
    redirect(pageHref(lastPage));
  }

  // Checked rather than cast. A record that cannot be understood is rendered as a
  // named row saying so, instead of being dropped: the public list may quietly
  // omit a malformed car, but a staff member looking for a vehicle they just
  // saved needs to be told when the API sent something unreadable.
  const rows: ListRow[] = result.items.map((record) => {
    const parsed = parseStaffVehicle(record);
    return parsed.ok
      ? { tag: "ok", vehicle: parsed.value }
      : { tag: "unreadable", id: String(record.id), error: parsed.error };
  });

  return (
    <Container className="py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <SectionHeading
          title="Vehicles"
          description={
            result.total === 1
              ? "1 vehicle, including archived."
              : `${result.total.toLocaleString("en-AE")} vehicles, including archived.`
          }
        />

        <ActionLink href={STAFF_NEW_VEHICLE}>Add a vehicle</ActionLink>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No vehicles yet"
          description="Add the first one, and it appears on the public inventory straight away."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {rows.map((row) =>
              row.tag === "ok" ? (
                <VehicleRow key={row.vehicle.id} vehicle={row.vehicle} />
              ) : (
                <Surface key={row.id} className="p-4">
                  <p className="text-body-sm text-danger">
                    A vehicle could not be displayed: {row.error}
                  </p>
                </Surface>
              ),
            )}
          </ul>

          {result.total_pages > 1 ? (
            <Pager page={page} totalPages={result.total_pages} total={result.total} />
          ) : null}
        </>
      )}
    </Container>
  );
}

/**
 * Previous/next controls.
 *
 * Rendered only when there is more than one page. A pager with a single page behind
 * it is a control that cannot do anything, and showing it anyway teaches staff
 * members that the list is paginated when it is not.
 *
 * The unavailable end is a `<span>` rather than a hidden link, for the same reason
 * the image manager's arrow buttons are disabled rather than hidden: a control that
 * disappears moves everything around it, so the row somebody was aiming at is no
 * longer under the pointer.
 */
function Pager({
  page,
  totalPages,
  total,
}: {
  page: number;
  totalPages: number;
  total: number;
}) {
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <nav
      aria-label="Vehicle pages"
      className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6"
    >
      <p className="text-body-sm text-fg-muted">
        Showing {first.toLocaleString("en-AE")}&ndash;{last.toLocaleString("en-AE")} of{" "}
        {total.toLocaleString("en-AE")}
      </p>

      <Cluster gap="sm">
        {page > 1 ? (
          <ActionLink href={pageHref(page - 1)} variant="secondary" size="sm">
            Previous
          </ActionLink>
        ) : (
          <span className="text-body-sm text-fg-subtle">Previous</span>
        )}

        <span className="text-body-sm text-fg-muted">
          Page {page} of {totalPages}
        </span>

        {page < totalPages ? (
          <ActionLink href={pageHref(page + 1)} variant="secondary" size="sm">
            Next
          </ActionLink>
        ) : (
          <span className="text-body-sm text-fg-subtle">Next</span>
        )}
      </Cluster>
    </nav>
  );
}

/**
 * A link to another page of the list.
 *
 * Returned as a template type rather than `string` so `ActionLink` still gets
 * Next's route checking - a widened `string` would typecheck against anything,
 * which is the opposite of the point of having a pager.
 */
function pageHref(page: number): `${typeof STAFF_VEHICLES}?page=${number}` {
  return `${STAFF_VEHICLES}?page=${page}`;
}

/** The first value of a possibly-repeated query parameter. */
function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** A page number, or 1. See the note at the call site. */
function clampPage(raw: string | null): number {
  if (raw === null) return 1;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;

  return parsed;
}

/** Badge tone per availability, so the state is readable without reading the word. */
const STATUS_TONE: Record<VehicleAvailability, "success" | "warning" | "neutral"> = {
  available: "success",
  reserved: "warning",
  sold: "neutral",
};

/**
 * One vehicle.
 *
 * The whole row is not a link. A card-sized click target covering a row of text
 * is hard to hit accurately and hides the real destinations, so the vehicle's name
 * is the link and the row is a layout. That is also what lets the status badges
 * be read without accidentally navigating.
 */
function VehicleRow({ vehicle }: { vehicle: StaffVehicle }) {
  return (
    <Surface as="li" className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <Cluster gap="sm">
            <Link
              href={staffVehicle(vehicle.id)}
              className="text-body font-semibold text-fg underline underline-offset-4 hover:text-fg-secondary"
            >
              {vehicle.make} {vehicle.model}
            </Link>

            {/*
              Archived is a separate badge from the availability state, because it
              answers a different question. "Reserved" is still for sale; "sold"
              is a historical record. Only one of the three removes a vehicle from
              the public site, and a single column cannot say both things without
              one of them being ambiguous.
            */}
            {vehicle.archivedAt ? <Badge tone="danger">Archived</Badge> : null}

            <Badge tone={STATUS_TONE[vehicle.status]}>{LABEL[vehicle.status]}</Badge>
          </Cluster>

          <p className="mt-1 text-body-sm text-fg-muted">
            {vehicle.year}
            {vehicle.variant ? ` · ${vehicle.variant}` : ""}
            {" · "}
            {vehicle.price === null
              ? "Price on request"
              : `${vehicle.price.toLocaleString("en-AE")} ${vehicle.currency}`}
          </p>
        </div>

        <Cluster gap="sm">
          {/*
            The photograph count, because "why does this vehicle show a
            placeholder on the public site" is answered by "it has no
            photographs" and the editor is one click away.
          */}
          <span className="text-body-sm text-fg-muted">
            {vehicle.images.length === 0
              ? "No photographs"
              : `${vehicle.images.length} ${vehicle.images.length === 1 ? "photograph" : "photographs"}`}
          </span>

          <ActionLink href={staffVehicle(vehicle.id)} variant="secondary" size="sm">
            Edit
          </ActionLink>
        </Cluster>
      </div>
    </Surface>
  );
}

/** Availability states as a staff member reads them, not as the API stores them. */
const LABEL: Record<VehicleAvailability, string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
};
