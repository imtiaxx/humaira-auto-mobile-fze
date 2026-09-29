import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getEnquiry } from "@/lib/api/admin-enquiries";
import { ApiError } from "@/lib/api/errors";
import { updateEnquiryStatusAction } from "@/app/staff/actions/enquiries";
import { requireStaff } from "@/lib/staff/dal";
import { parseEnquiry } from "@/features/staff/lib/enquiry-schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Cluster } from "@/components/ui/stack";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";
import { STAFF_ENQUIRIES, staffVehicle } from "@/features/staff/lib/routes";
import type { Enquiry, EnquiryStatus } from "@/types/enquiry";

/**
 * One enquiry, and the control that moves it through its statuses.
 *
 * ---------------------------------------------------------------------------
 * Why this is a page and not a panel on the list
 * ---------------------------------------------------------------------------
 * Because the message is the point. The list deliberately does not show it - a
 * column of twenty messages is a wall - so somewhere has to be long enough to read
 * one properly, and that is here. A modal would be the other option and it is
 * worse for the only thing this screen is used for: answering. A reply is typed
 * into a mail client, and a modal that has to be closed first is one more step
 * between reading somebody's question and getting to a keyboard.
 *
 * ---------------------------------------------------------------------------
 * Why the status control is a row of buttons rather than a select
 * ---------------------------------------------------------------------------
 * Three states, all reachable, no illegal moves. A dropdown would be strictly
 * worse: it hides two-thirds of the options, needs a second click to do nothing
 * about the third, and on a phone it opens a native picker over the very message
 * the staff member is reading. Buttons also make the *current* state obvious,
 * which matters because this is the field staff members most often want to
 * confirm.
 *
 * Every button posts to a server action, and the action is bound to both the id
 * and the status - see the note in `app/staff/actions/enquiries.ts`. There is no
 * hidden field a form can be edited to point at a different record.
 */
export const metadata: Metadata = {
  title: "Enquiry",
};

export default async function StaffEnquiryPage({ params }: PageProps<"/staff/enquiries/[enquiryId]">) {
  await requireStaff();

  const { enquiryId } = await params;

  // Only 404 becomes a 404. A 401 here means the session died between the layout's
  // check and this fetch, and reporting "not found" would send a signed-in staff
  // member hunting for an enquiry that exists. See the vehicle page for the full
  // note; the reasoning is the same.
  let record: unknown = null;
  try {
    record = await getEnquiry(enquiryId);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }

  if (record === null) notFound();

  const parsed = parseEnquiry(record);
  if (!parsed.ok) {
    // Thrown rather than rendered empty: a page that says "this enquiry is
    // unreadable" and then offers buttons that write to it would be worse than an
    // error, because a member of staff could close a record they never read.
    throw new Error(parsed.error);
  }

  const enquiry = parsed.value;

  return (
    <Container className="py-10">
      <nav aria-label="Breadcrumb" className="mb-4">
        <Link
          href={STAFF_ENQUIRIES}
          className="text-body-sm text-fg-muted underline underline-offset-4 hover:text-fg"
        >
          All enquiries
        </Link>
      </nav>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Cluster gap="sm">
            <h1 className="text-display-sm text-fg">{enquiry.customerName}</h1>
            <Badge tone={STATUS_TONE[enquiry.status]}>{STATUS_LABEL[enquiry.status]}</Badge>
          </Cluster>

          <p className="mt-1 text-body-sm text-fg-muted">
            {formatWhen(enquiry.createdAt)} · last updated {formatWhen(enquiry.updatedAt)}
          </p>
        </div>

        <StatusControl enquiry={enquiry} />
      </div>

      <div className="flex flex-col gap-10">
        {/*
          Contact details first, as an address list.

          The point of this page is a reply, and the reply needs a name, an address
          and a number. They are the three things a staff member will copy, so they
          are given as text that can be selected and read aloud, not as buttons
          whose only function is to hand a string to a clipboard.
        */}
        <section className="flex flex-col gap-4">
          <SectionHeading level={2} title="Contact" />

          <Surface className="max-w-3xl p-6">
            <dl className="grid gap-4 sm:grid-cols-[8rem_1fr]">
              <dt className="text-body-sm font-medium text-fg-muted">Email</dt>
              <dd className="min-w-0 text-body text-fg">
                <a
                  href={`mailto:${enquiry.customerEmail}`}
                  className="underline underline-offset-4 hover:text-fg-secondary"
                >
                  {enquiry.customerEmail}
                </a>
              </dd>

              <dt className="text-body-sm font-medium text-fg-muted">Phone</dt>
              <dd className="text-body text-fg">
                {/*
                  `tel:` so a phone can dial it. The displayed text is left as
                  stored, punctuation and all, because that is how it was typed and
                  how the customer will recognise it when they answer.
                */}
                <a
                  href={`tel:${enquiry.customerPhone.replace(/[^\d+]/g, "")}`}
                  className="underline underline-offset-4 hover:text-fg-secondary"
                >
                  {enquiry.customerPhone}
                </a>
              </dd>
            </dl>
          </Surface>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading level={2} title="Message" />

          {/*
            `whitespace-pre-wrap` is what makes this readable, and it is doing real
            work rather than decoration. A visitor's message arrives with its
            newlines intact - the backend trims the ends of it and the staff parser
            leaves the inside alone, precisely so that the paragraph breaks they
            typed survive to be rendered here. Without this class those breaks
            would collapse into one run-on line and a three-question enquiry would
            read as a single sentence.

            React escapes the text, so the characters a visitor typed cannot become
            markup here. That is the whole of the answer to "is this field safe":
            the backend deliberately does not police the contents of a message,
            because escaping at render time is the thing that makes it safe, and
            this is that place.
          */}
          <Surface className="max-w-3xl p-6">
            <p className="text-body whitespace-pre-wrap text-fg">{enquiry.message}</p>
          </Surface>
        </section>

        <section className="flex flex-col gap-4">
          <SectionHeading level={2} title="Vehicle" />

          <Surface className="max-w-3xl p-6">
            <p className="text-body-sm text-fg-muted">
              This enquiry was about{" "}
              <Link
                href={staffVehicle(enquiry.vehicleId)}
                className="font-medium text-fg underline underline-offset-4 hover:text-fg-secondary"
              >
                the vehicle
              </Link>
              {/*
                The slug is shown rather than only linked, because it is the one
                identifier that means the same thing on the public site. A staff
                member who needs to find this vehicle on the public inventory can
                read it off the screen instead of guessing which of several similar
                cars it was.
              */}
              , which is published at /inventory/{enquiry.vehicleSlug}.
            </p>
          </Surface>
        </section>
      </div>
    </Container>
  );
}

/**
 * The three status buttons.
 *
 * The current status is rendered as disabled text rather than as an enabled
 * button that would send a no-op. A button that looks live and does nothing is
 * worse than one that is plainly not offered: a member of staff who clicks
 * "Pending" on a pending enquiry should not be left wondering whether the click
 * registered.
 *
 * `secondary` for every movable state, because none of them is more important
 * than the others - the backend explicitly allows moving backwards, and a layout
 * that implied otherwise would discourage the correction that is the whole reason
 * the transitions are unconstrained.
 */
function StatusControl({ enquiry }: { enquiry: Enquiry }) {
  return (
    <Cluster gap="sm">
      {STATUSES_IN_BACKLOG_ORDER.map((status) =>
        status === enquiry.status ? (
          <Button key={status} type="button" variant="secondary" disabled>
            {STATUS_LABEL[status]}
          </Button>
        ) : (
          <form
            key={status}
            action={updateEnquiryStatusAction.bind(null, enquiry.id, status)}
          >
            <Button type="submit" variant="secondary">
              {transitionLabel(status)}
            </Button>
          </form>
        ),
      )}
    </Cluster>
  );
}

/**
 * What moving to `to` is called, from the current state.
 *
 * Reads as an instruction to the person doing it - "Answer", "Reopen" - because
 * that is what it is. The alternative, labelling every button with the status it
 * produces, gives three identical-looking "Pending" / "Answered" / "Closed"
 * buttons and makes the reader work out which one is the current value.
 *
 * Only `to` is needed: from any of the three states, the label for a given target
 * is the same. `from` would be a parameter to satisfy a symmetry that does not
 * exist.
 */
function transitionLabel(to: EnquiryStatus): string {
  if (to === "pending") return "Reopen";
  if (to === "answered") return "Answer";
  return "Close";
}

/** Shown alongside a status, so the button group reads without the badge. */
const STATUS_LABEL: Record<EnquiryStatus, string> = {
  pending: "Pending",
  answered: "Answered",
  closed: "Closed",
};

const STATUSES_IN_BACKLOG_ORDER: readonly EnquiryStatus[] = ["pending", "answered", "closed"];

const STATUS_TONE: Record<EnquiryStatus, "warning" | "success" | "neutral"> = {
  pending: "warning",
  answered: "success",
  closed: "neutral",
};

/**
 * A timestamp as an absolute date and time.
 *
 * Absolute here, unlike the list's relative wording, and the difference is the
 * point: on this screen a staff member is reconstructing when a conversation
 * happened - "did they email me on Tuesday?" - and relative wording would make
 * them convert. The list uses relative wording because there the question is "how
 * long has this been waiting?", and the two questions want opposite answers.
 */
function formatWhen(iso: string): string {
  if (iso === "") return "at an unknown time";

  const when = Date.parse(iso);
  if (Number.isNaN(when)) return "at an unknown time";

  return new Date(when).toLocaleString("en-AE", {
    dateStyle: "long",
    timeStyle: "short",
  });
}
