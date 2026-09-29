import Link from "next/link";

import { WhatsAppCta } from "@/components/cta/whatsapp-cta";
import { ArrowRight } from "@/components/icons";
import { Container } from "@/components/ui/container";
import { EnquiryForm } from "@/features/vehicles/components/enquiry-form";
import { formatVehiclePrice, hasQuotedPrice, vehicleTitleWithYear } from "@/features/vehicles/lib/format";
import type { Vehicle } from "@/types/vehicle";

/**
 * The page's conversion area: the primary enquiry action and the secondary path.
 *
 * ---------------------------------------------------------------------------
 * The message names the vehicle before the customer has to
 * ---------------------------------------------------------------------------
 * The pre-filled message is built from the vehicle's own data, so the conversation
 * opens with the car already identified rather than with a customer having to
 * describe it. That is the entire advantage a detail page has over a generic
 * contact form, and it is why the reference is composed here rather than left as
 * a default message.
 *
 * The number comes from the environment through `WhatsAppCta`; there is no
 * fallback number in this file and no way to configure one here.
 *
 * ---------------------------------------------------------------------------
 * Why the action is `disabled` rather than hidden when unconfigured
 * ---------------------------------------------------------------------------
 * This is a page whose entire job is offering an enquiry about one specific
 * vehicle. If the button silently disappeared, the page would look broken and a
 * visitor would assume the site had an error. `unavailable="disabled"` renders a
 * visibly unavailable control carrying `aria-disabled`, which tells a screen-reader
 * user why it will not respond instead of leaving them to discover it.
 *
 * It is `aria-disabled` rather than a real `disabled` attribute because this is a
 * link-shaped control, not a form field, and because the state should be
 * discoverable rather than hidden from the accessibility tree.
 *
 * ---------------------------------------------------------------------------
 * A sold or reserved vehicle still gets a truthful action
 * ---------------------------------------------------------------------------
 * A sold vehicle is not suppressed. The enquiry is still real - someone who wants
 * a sold vehicle is a genuine sourcing lead, and that is precisely the
 * "not the one you have?" case. The copy changes with the status instead of the
 * component disappearing, so the page never implies it is unavailable for a
 * reason it will not explain.
 *
 * ---------------------------------------------------------------------------
 * The secondary path is a real destination
 * ---------------------------------------------------------------------------
 * "Looking for something else?" points at `/inventory`, which exists. It
 * deliberately does not point at the still-`planned` navigation entries
 * ("Request a Vehicle", "Contact") - those routes are not built, and this is the
 * one place on the page where a visitor is most likely to follow a link, so a
 * dead end here would be the most visible one on the site.
 *
 * It also does not point at `/compare`. A comparison is a decision about *several*
 * vehicles, and this panel belongs to one vehicle: linking to a page that asks
 * the visitor to choose two to four cars, from the middle of a panel about this
 * one, would answer a question they did not ask. The route is reachable from the
 * header and the footer on every page, which is where a cross-cutting action
 * belongs.
 *
 * When a real request route is built it can be added here alongside this link
 * rather than replacing it.
 */
export function VehicleEnquiry({ vehicle }: { vehicle: Vehicle }) {
  const reference = vehicleTitleWithYear(vehicle);
  const price = formatVehiclePrice(vehicle);
  const sold = vehicle.status === "sold";

  return (
    <section aria-labelledby="vehicle-enquiry-heading" className="on-inverse bg-page">
      <Container className="py-16 sm:py-20">
        {/*
          A grid, and the reason the copy is wrapped in a column of its own is the
          reason for the grid: the WhatsApp button is a natural fit next to a
          paragraph of copy in a flex row, and the form is not. See the note at the
          form for the full argument.
        */}
        <div className="grid gap-8 rounded-card border border-line bg-page p-6 sm:p-8 lg:grid-cols-2 lg:gap-10">
          <div className="flex max-w-2xl flex-col gap-2">
            <h2 id="vehicle-enquiry-heading" className="text-h2 text-fg text-balance">
              {sold ? "Looking for a similar vehicle?" : "Enquire about this vehicle"}
            </h2>

            <p className="text-body text-fg-secondary">
              {sold ? (
                <>
                  This {reference} has been sold. If you are looking for the same
                  model, or something comparable, we can source it - tell us the
                  make, model, year and budget you are working to.
                </>
              ) : (
                <>
                  Ask about the {reference} and we will confirm its current
                  availability, arrange a viewing at our Dubai showroom, and send
                  the details you need to decide.
                </>
              )}
            </p>

            {/*
              The price is repeated in the enquiry context only when there is a
              real figure, and `hasQuotedPrice` is what decides - the same
              predicate the page metadata uses, so the two cannot drift. A
              "Price on request" line here would tell a customer something they
              have just been told two hundred pixels above, and "Listed at Sold"
              would be nonsense.
            */}
            {hasQuotedPrice(vehicle) ? (
              <p className="tnum text-caption text-fg-muted">
                Listed at {price}
              </p>
            ) : null}
          </div>

          {/*
            `shrink-0` keeps the button at its natural width beside the copy
            instead of stretching, and `self-start` stops it spanning a phone
            screen. Both matter at 320px, where the label plus icon is close to
            the full content width.
          */}
          <WhatsAppCta
            label={sold ? "Enquire about a similar vehicle" : "Enquire on WhatsApp"}
            ariaLabel={
              sold
                ? `Enquire about a vehicle similar to the ${reference}`
                : `Enquire about the ${reference}`
            }
            message={
              sold
                ? `Hello Humera Automobile, I saw the ${reference} has been sold. Could you source a similar vehicle for me?`
                : `Hello Humera Automobile, I would like to enquire about the ${reference}.`
            }
            unavailable="disabled"
            variant="accent"
            size="lg"
            className="shrink-0 self-start lg:self-center"
          />

          {/*
            The website form, in its own column beside the copy and the CTA.

            ---------------------------------------------------------------------------
            Why a column and not a third item in a flex row
            ---------------------------------------------------------------------------
            The form is four fields, and the panel is a flex row whose other two
            children are a paragraph and a button. Squeezing all three onto one
            line at `lg` gives the form roughly 200px, which is narrower than a
            mobile phone input and produces a message textarea two characters wide
            on a desktop. A two-column grid gives each half the width it needs and
            stacks them below `lg`, which is the right order: the copy first, then
            the WhatsApp button, then the form - so a visitor who wants the fastest
            route to a human sees it above the form they have to fill in.

            ---------------------------------------------------------------------------
            Why the vehicle is not a field
            ---------------------------------------------------------------------------
            `slug` is passed as a prop and bound into the Server Action, so there is
            no hidden input naming the vehicle. That is not tidiness. The backend's
            `EnquiryWrite` is `extra="forbid"` and takes the vehicle from the path,
            so posting `vehicle_id` or `vehicle_slug` as form fields would be a
            422 - and were they accepted, they would be a way for a visitor to file
            an enquiry about a car this page is not about.
          */}
          <EnquiryForm slug={vehicle.slug} vehicleName={reference} />
        </div>

        {/*
          The secondary path, below the panel rather than inside it, so it reads
          as "something else" and not as a second button competing with the
          primary action.
        */}
        <div className="mt-8 flex flex-col gap-3">
          <p className="text-caption text-fg-muted uppercase">Or</p>

          <Link
            href="/inventory"
            className="inline-flex items-center gap-2 self-start text-body-sm text-fg-secondary transition-colors hover:text-fg"
          >
            <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            Looking for something else? Browse all vehicles
          </Link>
        </div>
      </Container>
    </section>
  );
}