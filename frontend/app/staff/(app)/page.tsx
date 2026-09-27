import type { Metadata } from "next";

import { getInventorySummary } from "@/lib/api/admin-vehicles";
import { requireStaff } from "@/lib/staff/dal";
import { parseInventorySummary } from "@/features/staff/lib/staff-schema";
import { ActionLink } from "@/components/ui/action-link";
import { Cluster } from "@/components/ui/stack";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";
import { STAFF_NEW_VEHICLE, STAFF_VEHICLES } from "@/features/staff/lib/routes";

/**
 * The staff dashboard: real counts, and the two things anybody does next.
 *
 * ---------------------------------------------------------------------------
 * What is on this page, and what is deliberately not
 * ---------------------------------------------------------------------------
 * Counts and links. No trend, no growth percentage, no "vehicles added this
 * month", no comparison against last month.
 *
 * The backend's summary endpoint is four `COUNT` queries over four tables, and its
 * own description is explicit about why: the schema keeps no history, so there is
 * nothing to compute a trend from. A dashboard that showed one anyway would be
 * inventing a number about the business, and this project has repeatedly refused
 * to do that - the same reasoning that leaves the WhatsApp CTA suppressed when no
 * number is configured.
 *
 * So every figure below is a count of rows that exist. A count the endpoint did
 * not report is read as zero, which is the truthful reading of "not reported", and
 * `parseInventorySummary` is where that decision lives.
 *
 * ---------------------------------------------------------------------------
 * Why a failed request does not render as zeroes
 * ---------------------------------------------------------------------------
 * `getInventorySummary()` throws an `ApiError` when the API is unreachable, and
 * `app/staff/error.tsx` catches it. That is the correct outcome and it is worth
 * being explicit about why, because swallowing the error would be easier: four
 * zeros look like a working dashboard. They would be a statement about the
 * business - "we have no vehicles" - that is simply false, on a page whose whole
 * purpose is to state facts about the inventory.
 */
export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function StaffDashboardPage() {
  // The layout already called `requireStaff()`, and the DAL memoises with React's
  // `cache`, so this is not a second API call. It is here so the page does not
  // depend on a parent having run the guard: a page that is only safe because of
  // its layout is one refactor away from quietly not being safe.
  await requireStaff();

  const summary = parseInventorySummary(await getInventorySummary());

  return (
    <Container className="py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <SectionHeading
          title="Dashboard"
          description="Every figure below is a live count from the database."
        />

        {/*
          `ActionLink` rather than a `Button`, because these navigate and the
          other one submits. An anchor styled as a button is announced as a link
          and activated by Enter but not by Space - invisible to a sighted user
          and wrong for everyone else.
        */}
        <Cluster gap="sm">
          <ActionLink href={STAFF_VEHICLES} variant="secondary">
            All vehicles
          </ActionLink>
          <ActionLink href={STAFF_NEW_VEHICLE}>Add a vehicle</ActionLink>
        </Cluster>
      </div>

      {/*
        Four figures and no more. A grid of invented metrics would look more
        impressive and tell a staff member nothing they could act on.
      */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CountCard label="Published" value={summary.totalPublished} />
        <CountCard label="Archived" value={summary.archived} />
        <CountCard label="Available" value={summary.byAvailability.available ?? 0} />
        <CountCard label="Photographs" value={summary.imageCount} />
      </div>
    </Container>
  );
}

/**
 * One figure.
 *
 * `<dl>` with `<dt>`/`<dd>` rather than two `<p>` elements: this is a description
 * list, it is what a screen reader announces as a labelled value, and the
 * semantics survive the grid being read column by column on a narrow screen.
 *
 * `tabular-nums` so a changing count does not shift the digits sideways. On a
 * dashboard that is revalidated after every write, a number that jitters in width
 * on each save is the kind of small wrongness that makes a number hard to read.
 */
function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <Surface className="p-5">
      <dl className="flex flex-col gap-1">
        <dt className="text-body-sm text-fg-muted">{label}</dt>
        <dd className="text-display-sm font-semibold text-fg tabular-nums">
          {value.toLocaleString("en-AE")}
        </dd>
      </dl>
    </Surface>
  );
}
