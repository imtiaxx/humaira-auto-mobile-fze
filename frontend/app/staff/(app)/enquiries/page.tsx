import type { Metadata } from "next";
import Link from "next/link";

import { getEnquiryPage } from "@/lib/api/admin-enquiries";
import { requireStaff } from "@/lib/staff/dal";
import { parseEnquiryPage } from "@/features/staff/lib/enquiry-schema";
import { ActionLink } from "@/components/ui/action-link";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button-styles";
import { Cluster } from "@/components/ui/stack";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/states";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";
import { STAFF_ENQUIRIES } from "@/features/staff/lib/routes";
import type { Enquiry, EnquiryStatus } from "@/types/enquiry";

/**
 * The staff enquiry list - the dealership's inbox for website enquiries.
 *
 * ---------------------------------------------------------------------------
 * Why this is a backlog, not a contact list
 * ---------------------------------------------------------------------------
 * Because the only question this screen exists to answer is "who has not been
 * answered yet". A record's status is the whole of its state, there is nothing to
 * edit about the record itself, and nothing about an enquiry can be changed except
 * that status. So the row is a reader for a customer and a way into the record,
 * and the filter is the primary control rather than a convenience.
 *
 * ---------------------------------------------------------------------------
 * Why the message is *not* in this list
 * ---------------------------------------------------------------------------
 * It is on the detail page. A list of twenty messages is a wall, and the thing a
 * staff member needs from a list is who and when, so each row is short enough to
 * scan in a column. The message is the reason the row is a link, not the reason
 * the row is long.
 *
 * ---------------------------------------------------------------------------
 * Pagination
 * ---------------------------------------------------------------------------
 * The same reasoning as the vehicle list, and with the same asymmetry: the
 * backend's `per_page` caps at 100, and a dealership accumulates enquiries
 * indefinitely - faster than vehicles, because enquiries are cheap to make and
 * most are about the same three cars. A list that silently stopped at the first
 * page would be a list whose most important entries (the oldest unanswered) are
 * exactly the ones missing.
 */
export const metadata: Metadata = {
  title: "Enquiries",
};

/** Rows per page. Matches the backend's cap, so nothing is silently truncated. */
const PAGE_SIZE = 20;

export default async function StaffEnquiriesPage({
  searchParams,
}: PageProps<"/staff/enquiries">) {
  await requireStaff();

  const query = await searchParams;

  // Clamped for the same reason as the vehicle pager: `?status=wat` or `?page=abc`
  // would otherwise reach the API, and what comes back would depend on which of
  // the two the backend happens to prefer. See the vehicle page for the full note.
  const statusFilter = statusParam(firstValue(query.status));
  const page = clampPage(firstValue(query.page));

  const result = parseEnquiryPage(
    await getEnquiryPage({
      status: statusFilter ?? undefined,
      page,
      perPage: PAGE_SIZE,
    }),
  );

  // Unlike the vehicle list there is no redirect here, because the enquiry
  // envelope has no `total_pages` to redirect *to* - the last page is computed
  // below, and a URL naming a page past the end renders as an empty list. The
  // pager is therefore always drawn when a next page exists, so a member of staff
  // who arrives on a stale link has a way forward rather than a dead end.
  const lastPage = Math.max(Math.ceil(result.total / PAGE_SIZE), 1);

  return (
    <Container className="py-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <SectionHeading
          title="Enquiries"
          description={
            result.total === 1
              ? "1 enquiry."
              : `${result.total.toLocaleString("en-AE")} enquiries.`
          }
        />

        <StatusFilter current={statusFilter} />
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          title={statusFilter === null ? "No enquiries yet" : `No ${statusFilter} enquiries`}
          description={
            statusFilter === null
              ? "Enquiries sent from a vehicle page appear here."
              : "Try another status, or clear the filter to see every enquiry."
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {result.items.map((enquiry) => (
              <EnquiryRow key={enquiry.id} enquiry={enquiry} />
            ))}
          </ul>

          {/*
            A row that failed to parse is dropped by `parseEnquiryPage`, so the
            count and the rows can legitimately disagree. Saying so beats letting a
            staff member conclude enquiries have gone missing - which, on a screen
            whose entire purpose is "did we lose somebody's request", is the one
            conclusion that must not be reachable without an explanation.
          */}
          {result.skipped > 0 ? (
            <p className="mt-4 text-body-sm text-danger">
              {result.skipped} {result.skipped === 1 ? "enquiry" : "enquiries"} could not be
              displayed. The API returned something this admin does not recognise.
            </p>
          ) : null}

          {lastPage > 1 ? <Pager page={page} lastPage={lastPage} total={result.total} filter={statusFilter} /> : null}
        </>
      )}
    </Container>
  );
}

/**
 * The status filter.
 *
 * Built as links rather than a `<select>`, and this is not a preference. A select
 * that filters on `onChange` needs JavaScript, and the cost of that is that the
 * filtered view has no URL: it cannot be linked, bookmarked, shared, or reached
 * with the back button, so "show me the pending ones" becomes something a staff
 * member has to re-do every time they come back to the tab. As links each state
 * is a real address.
 *
 * The alternative - a `<form method="get">` with a submit button - was rejected
 * because it hides the state behind a control that has to be pressed, and this
 * filter is a navigation.
 */
function StatusFilter({ current }: { current: EnquiryStatus | null }) {
  return (
    <nav aria-label="Filter by status" className="flex flex-wrap items-center gap-2">
      <StatusFilterLink label="All" status={null} current={current} />
      {STATUSES_IN_BACKLOG_ORDER.map((status) => (
        <StatusFilterLink key={status} label={STATUS_LABEL[status]} status={status} current={current} />
      ))}
    </nav>
  );
}

function StatusFilterLink({
  label,
  status,
  current,
}: {
  label: string;
  status: EnquiryStatus | null;
  current: EnquiryStatus | null;
}) {
  const href = filterHref(status, 1);
  const isCurrent = status === current;

  return (
    <Link
      href={href}
      // `aria-current` rather than only a colour: the active filter is the one
      // control on this page whose state a screen reader user cannot otherwise
      // perceive.
      aria-current={isCurrent ? "page" : undefined}
      className={filterClasses(isCurrent)}
    >
      {label}
    </Link>
  );
}

/** One enquiry. */
function EnquiryRow({ enquiry }: { enquiry: Enquiry }) {
  return (
    <Surface as="li" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <Cluster gap="sm">
            {/*
              The name is the link rather than the whole row. A card-sized click
              target covering a row of text is hard to hit accurately and hides the
              other destination on the row - here, the vehicle the enquiry was about,
              which is a genuinely different page.
            */}
            <Link
              href={enquiryHref(enquiry.id)}
              className="text-body font-semibold text-fg underline underline-offset-4 hover:text-fg-secondary"
            >
              {enquiry.customerName}
            </Link>

            <Badge tone={STATUS_TONE[enquiry.status]}>{STATUS_LABEL[enquiry.status]}</Badge>
          </Cluster>

          <p className="mt-1 text-body-sm text-fg-muted">
            {enquiry.customerEmail} · {enquiry.customerPhone}
          </p>

          <p className="mt-1 text-body-sm text-fg-subtle">
            About{" "}
            <Link
              href={staffVehicleHref(enquiry.vehicleId)}
              className="underline underline-offset-4 hover:text-fg"
            >
              this vehicle
            </Link>{" "}
            · {formatWhen(enquiry.createdAt)}
          </p>
        </div>

        <ActionLink href={enquiryHref(enquiry.id)} variant="secondary" size="sm">
          Open
        </ActionLink>
      </div>
    </Surface>
  );
}

/**
 * Previous/next controls.
 *
 * Mirrors the vehicle list's pager, including the decision to render the
 * unavailable end as a `<span>`: a control that disappears moves everything around
 * it, so the row somebody was aiming at is no longer under the pointer.
 */
function Pager({
  page,
  lastPage,
  total,
  filter,
}: {
  page: number;
  lastPage: number;
  total: number;
  filter: EnquiryStatus | null;
}) {
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <nav
      aria-label="Enquiry pages"
      className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6"
    >
      <p className="text-body-sm text-fg-muted">
        Showing {first.toLocaleString("en-AE")}&ndash;{last.toLocaleString("en-AE")} of{" "}
        {total.toLocaleString("en-AE")}
      </p>

      <Cluster gap="sm">
        {page > 1 ? (
          <ActionLink href={filterHref(filter, page - 1)} variant="secondary" size="sm">
            Previous
          </ActionLink>
        ) : (
          <span className="text-body-sm text-fg-subtle">Previous</span>
        )}

        <span className="text-body-sm text-fg-muted">
          Page {page} of {lastPage}
        </span>

        {page < lastPage ? (
          <ActionLink href={filterHref(filter, page + 1)} variant="secondary" size="sm">
            Next
          </ActionLink>
        ) : (
          <span className="text-body-sm text-fg-subtle">Next</span>
        )}
      </Cluster>
    </nav>
  );
}

/* -------------------------------------------------------------------------
 * Status vocabulary
 * ---------------------------------------------------------------------- */

/**
 * Newest state first, because that is the order a backlog is worked.
 *
 * `pending` first is the point: the filter exists to get the unanswered to the
 * top, and putting `closed` first would bury them under a column nobody reads.
 */
const STATUSES_IN_BACKLOG_ORDER: readonly EnquiryStatus[] = ["pending", "answered", "closed"];

const STATUS_LABEL: Record<EnquiryStatus, string> = {
  pending: "Pending",
  answered: "Answered",
  closed: "Closed",
};

/**
 * Badge tone per status.
 *
 * `pending` is the only one that gets a colour that says "act on this". `closed`
 * is neutral rather than muted, because a closed enquiry is a *finished* one and
 * a status screen should be able to say that at a glance without implying an
 * error.
 */
const STATUS_TONE: Record<EnquiryStatus, "warning" | "success" | "neutral"> = {
  pending: "warning",
  answered: "success",
  closed: "neutral",
};

/* -------------------------------------------------------------------------
 * Small helpers
 * ---------------------------------------------------------------------- */

/** The filter's href, as a template type so `next/link` still checks the route. */
function filterHref(status: EnquiryStatus | null, page: number): `${typeof STAFF_ENQUIRIES}?${string}` {
  const search = new URLSearchParams();
  if (status !== null) search.set("status", status);
  search.set("page", String(page));
  return `${STAFF_ENQUIRIES}?${search.toString()}`;
}

/** A link to one enquiry, built as a template so the route is still checked. */
function enquiryHref(enquiryId: string): `/staff/enquiries/${string}` {
  return `/staff/enquiries/${enquiryId}`;
}

/** The vehicle an enquiry was about, for the row's secondary link. */
function staffVehicleHref(vehicleId: string): `/staff/vehicles/${string}` {
  return `/staff/vehicles/${vehicleId}`;
}

/**
 * The status the URL is asking for, or `null` for all of them.
 *
 * A membership check, not a cast. `?status=archived` would otherwise be forwarded
 * to the backend as though it meant something; it returns an empty list, and a
 * member of staff looking at an empty list with an unrecognised filter in the URL
 * has no way to tell that from "there are no enquiries".
 */
function statusParam(raw: string | null): EnquiryStatus | null {
  if (raw === null) return null;
  return (STATUSES_IN_BACKLOG_ORDER as readonly string[]).includes(raw)
    ? (raw as EnquiryStatus)
    : null;
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

/**
 * The enquiry's age, in words.
 *
 * Relative because "how long has this been sitting here" is the question, and
 * "2026-01-14 09:12:03" requires the reader to subtract from the current date in
 * their head. Beyond a week the absolute date is given too, because "3 weeks" is
 * how you recognise something you have already ignored once.
 *
 * An unparseable timestamp yields an empty string rather than "Invalid Date" or
 * `NaN`. `parseEnquiry` already defaults both timestamps to `""` for a record it
 * could not date, and this renders the same empty gap - a visibly missing value is
 * more honest than a fabricated one.
 */
function formatWhen(iso: string): string {
  if (iso === "") return "";

  const when = Date.parse(iso);
  if (Number.isNaN(when)) return "";

  const days = Math.floor((Date.now() - when) / 86_400_000);

  if (days < 0) return "just now";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;

  return `on ${new Date(when).toLocaleDateString("en-AE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

/**
 * The status filter's styling.
 *
 * `primary` for the current filter and `ghost` for the others, reusing the button
 * recipe rather than writing class names here. The reason is not
 * consistency-with-pretty but the note in `button-styles.ts`: the variants live in
 * a module deliberately free of `"use client"` precisely so a Server Component can
 * style a link as a button. These are links - a filter is navigation - and the
 * alternative, a `<select>` that filters on change, is a control whose state
 * cannot be linked or shared.
 *
 * The selected state is a filled near-black rather than a tint, because the filter
 * bar sits on a light surface and the point is to answer "what am I looking at?"
 * from across the room. `aria-current` carries the same fact to a screen reader.
 */
function filterClasses(isCurrent: boolean): string {
  return buttonClasses(isCurrent ? "primary" : "ghost", "sm");
}
