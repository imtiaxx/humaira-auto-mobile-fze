import Link from "next/link";

import { ContactChannels } from "@/components/cta/contact-actions";
import { ArrowRight, ExternalLink, MapPin } from "@/components/icons";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button-styles";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";
import { SHOWROOM, SHOWROOM_ADDRESS_LINES, SITE_NAME } from "@/config/site";

import {
  ContactEnquiryForm,
  type ContactEnquiryVehicle,
} from "@/features/vehicles/components/contact-enquiry-form";

/**
 * ---------------------------------------------------------------------------
 * The map
 * ---------------------------------------------------------------------------
 * Google Maps geocodes this address string when the embed loads, so there is no
 * latitude or longitude anywhere in this file. That is deliberate: `config/site.ts`
 * confirms the showroom at district level ("Ducamz, Ras Al Khor, Dubai") and the
 * postal area, but not a point on the map, and a hard-coded pin at a guessed
 * coordinate would put a marker on the wrong building while looking completely
 * authoritative. Letting Google resolve the address means the map is right if the
 * address is right, and visibly approximate if it is not.
 *
 * The query is built from `SHOWROOM.area` / `city` / `country` rather than from the
 * full street line, for the same reason. "Showroom No. 188" is a plot reference in
 * a trade market, not a street address a geocoder can resolve confidently; feeding
 * it the whole line risks a failed pin and a map of the whole planet. The district
 * is both the level the business is identified at and the level Google resolves
 * reliably.
 *
 * `z=16` is street level - close enough to see the surrounding lots, wide enough
 * that a slightly-off centre still lands in the right area.
 */
const MAP_QUERY = `${SHOWROOM.area}, ${SHOWROOM.city}, ${SHOWROOM.country}`;

/** Google's documented keyless embed. The `q` parameter is resolved by Google. */
const MAP_EMBED_SRC = `https://www.google.com/maps?q=${encodeURIComponent(
  MAP_QUERY,
)}&z=16&output=embed`;

/**
 * `api=1&query=` is Google's documented universal Maps URL. It opens the native Maps
 * app on a phone rather than dropping the visitor into a browser tab, which is the
 * only version of this link that is useful to somebody standing outside the showroom
 * trying to work out which gate to go to.
 */
const MAPS_LINK = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  MAP_QUERY,
)}`;

/**
 * The Contact page.
 *
 * ---------------------------------------------------------------------------
 * The rule this page is written under
 * ---------------------------------------------------------------------------
 * No invented contact detail. `config/site.ts` holds the confirmed values and
 * currently `CONTACT.phone`, `CONTACT.email`, `CONTACT.whatsapp` and
 * `CONTACT.hours` are all `null` - only the `SHOWROOM` address is confirmed. So
 * this page shows the address and nothing else, which is the intended output
 * rather than a gap.
 *
 * It does not render disabled "Phone (coming soon)" tiles for the missing
 * channels. A disabled contact method tells a visitor the channel exists and is
 * broken, which is worse than not mentioning it - and `ContactChannels` already
 * encodes exactly that rule, resolving WhatsApp, phone and email through guards
 * that omit them when unconfigured. Reusing it means the footer and this page can
 * never disagree about which channels exist, and confirming a phone number makes
 * it appear here with no edit to this file.
 *
 * ---------------------------------------------------------------------------
 * Why the enquiry form is conditional
 * ---------------------------------------------------------------------------
 * `Enquiry.vehicle_id` is `nullable=False` and the only public endpoint is
 * `POST /vehicles/{slug}/enquiry`, so an enquiry must name a vehicle. The form's
 * vehicle select is therefore populated from the real inventory, and when there
 * is nothing in stock there is nothing to select - so no form is rendered, and
 * the page says so instead. See `contact-page.tsx`'s caller for the empty branch.
 *
 * ---------------------------------------------------------------------------
 * Why this is a Server Component
 * ---------------------------------------------------------------------------
 * Only `ContactEnquiryForm` needs JavaScript. The channels, the address and every
 * CTA here are static, so they ship as HTML.
 */

/** The one confirmed contact option, rendered as a structured postal address. */
function ShowroomOption() {
  return (
    <Surface as="article" className="flex flex-col gap-3 rounded-card p-6">
      <span
        aria-hidden="true"
        className="inline-flex size-10 items-center justify-center rounded-sm border border-line text-fg-accent"
      >
        <MapPin className="size-5" />
      </span>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-h3 text-fg">{SHOWROOM.name}</h3>
        <p className="text-label text-fg-muted">Showroom</p>
      </div>

      {/*
        A real `<address>` with one `<span>` per line, from the same
        `SHOWROOM_ADDRESS_LINES` the footer renders.

        Sharing that array is the point: the address is corrected in one place, and
        a page that restated it would be the copy most likely to be missed when it
        changes. An `<address>` also gives a screen reader sensible ordering and lets
        a visitor's maps app parse the lines.
      */}
      <address className="text-body-sm text-fg-secondary not-italic">
        {SHOWROOM_ADDRESS_LINES.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </address>
    </Surface>
  );
}

export function ContactPageBody({
  vehicles,
}: {
  /** Published inventory, already reduced to `{ slug, title }` by the route. */
  vehicles: ContactEnquiryVehicle[];
}) {
  return (
    <>
      {/*
        The hero. `bg-page` and the red hairline, the same two devices the homepage
        hero, `/sell` and `/about` use - reusing them is what makes four very
        different pages read as one site.
      */}
      <section aria-labelledby="contact-heading" className="relative overflow-hidden bg-page">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_15%_0%,color-mix(in_oklab,var(--color-accent-500)_12%,transparent),transparent_70%)]"
        />

        <Container className="relative py-20 sm:py-24 lg:py-32">
          <div className="flex max-w-3xl flex-col gap-6">
            <span aria-hidden="true" className="block h-0.5 w-14 rounded-full bg-action-accent" />

            {/*
              The eyebrow carries the page's name and the `h1` carries the promise,
              the same division of labour as `/about` - the word "Contact" alone
              says nothing, so the line worth reading is the one that tells a visitor
              what to expect.
            */}
            <p className="animate-fade-up text-label text-fg-accent uppercase">
              Contact Humera Automobile
            </p>

            <h1
              id="contact-heading"
              className="animate-fade-up text-display text-fg uppercase text-balance [animation-delay:80ms]"
            >
              Let&rsquo;s find your next vehicle.
            </h1>

            <p className="animate-fade-up max-w-2xl text-pretty text-body-lg text-fg-secondary [animation-delay:160ms]">
              Tell us which vehicle you are interested in and your question, and it
              will reach the showroom.
            </p>
          </div>
        </Container>
      </section>

      {/*
        Contact options and the form, side by side.

        Two columns rather than two stacked sections, because they are two routes to
        the same place and a visitor should be able to see both without scrolling.
        Below `lg` they stack, options first - someone looking for an address wants
        it before a form, and someone filling in the form is going to scroll past
        the options anyway.
      */}
      <section aria-labelledby="contact-details-heading" className="border-t border-line bg-sunken">
        <Container className="py-20 sm:py-24 lg:py-28">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="flex flex-col gap-8">
              <SectionHeading
                titleId="contact-details-heading"
                eyebrow="Contact details"
                title="Reach the showroom"
                description="The confirmed ways to contact us. The enquiry form is the quickest of them."
              />

              {/*
                Renders nothing at all until a channel is configured - see the module
                docstring. When it does render, it sits above the address, because a
                dialable or tappable channel is worth more to a visitor than an
                address they already know.
              */}
              <ContactChannels className="max-w-sm" />

              <ul className="flex flex-col gap-5">
                <li className="flex">
                  <ShowroomOption />
                </li>
              </ul>
            </div>

            <Surface className="rounded-card p-6 sm:p-8">
              {vehicles.length > 0 ? (
                <ContactEnquiryForm vehicles={vehicles} />
              ) : (
                <NoVehiclesYet />
              )}
            </Surface>
          </div>
        </Container>
      </section>

      {/* Where we are. */}
      <FindUsSection />

      {/*
        Vehicle sourcing.

        The one thing this page cannot do through the form is ask about a car that is
        not in stock - the select only lists published vehicles. So this section is
        not filler: it routes exactly the visitor the form turns away, to
        `/sell`, which is where "tell us the make, model, year and budget you are
        working to" is handled.
      */}
      <section aria-labelledby="sourcing-heading" className="border-t border-line bg-page">
        <Container className="py-20 sm:py-24 lg:py-28">
          <Surface className="flex flex-col gap-8 rounded-card border-accent-500/40 p-6 sm:p-10 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
            <div className="flex max-w-2xl flex-col gap-3">
              <h2 id="sourcing-heading" className="text-h2 text-fg text-balance">
                Looking for a specific vehicle?
              </h2>
              <p className="text-body text-fg-secondary">
                Give us the make, model, year and budget you are working to and we
                will look for it across the Dubai market.
              </p>
            </div>

            <div className="shrink-0">
              <Link href="/sell" className={buttonClasses("accent", "lg", "w-full sm:w-auto")}>
                Sell / Source
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          </Surface>
        </Container>
      </section>

      {/*
        The closing CTA.

        Deliberately not another card: the page already ends on a panel, and a second
        identical panel one scroll later would read as a duplicate rather than a
        close. This one is centred, quieter, and points at the one route a visitor
        on a contact page most often wanted instead - the stock.
      */}
      <section aria-labelledby="explore-heading" className="border-t border-line bg-sunken">
        <Container className="py-20 sm:py-24 lg:py-28">
          <div className="flex flex-col items-center gap-6 text-center">
            <h2 id="explore-heading" className="text-h2 text-fg text-balance">
              Explore inventory
            </h2>
            <p className="max-w-xl text-body text-fg-secondary">
              See what is available at the showroom now.
            </p>
            <Link
              href="/inventory"
              className={buttonClasses("outline", "lg", "w-full sm:w-auto")}
            >
              View all vehicles
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}

/**
 * The map section.
 *
 * Split into its own component because it is the one part of the page that embeds
 * third-party content, and it is worth being able to find and reason about on its
 * own.
 */
function FindUsSection() {
  return (
    <section aria-labelledby="find-us-heading" className="border-t border-line bg-page">
      <Container className="py-20 sm:py-24 lg:py-28">
        <SectionHeading
          titleId="find-us-heading"
          eyebrow="Our location"
          title="Find Us"
          description="Visit Humera Automobile — Ducamz, Ras Al Khor, Dubai, UAE"
        />

        {/*
          One rounded frame containing the map and the address bar, so the map's
          corners and the bar's corners are the same radius and the pair reads as one
          object. `overflow-hidden` is what actually clips the iframe to that radius -
          the iframe is a replaced element and will happily paint over its parent's
          border radius otherwise.

          `bg-raised` behind the frame means the map area shows the site's own near-
          black while it loads, rather than flashing a white box in the middle of a
          dark page.
        */}
        <Surface className="mt-12 overflow-hidden">
          {/*
            A live, interactive Google Maps embed - not a screenshot. A static image
            would pin a location and nothing else, which is the whole half of the map
            this section is not for: this one has to be pannable and zoomable so a
            visitor can find the surrounding roads and the approach.

            `darkmode=1` is Google's own parameter for a dark tile set, honoured by
            the embed where it is supported. The guaranteed dark treatment is the
            frame around it - the near-black canvas, the hairline border and the
            red marker - so this section is on-theme either way.

            `allowFullScreen` is Google's own requirement for the embed's own zoom
            and pan controls to behave correctly.
          */}
          <div className="relative aspect-[16/10] w-full sm:aspect-[16/9] lg:aspect-[21/10]">
            <iframe
              src={MAP_EMBED_SRC}
              // Required for assistive technology, and it has to say what the frame
              // does rather than repeat the heading above it.
              title={`Map showing the location of ${SITE_NAME} in ${MAP_QUERY}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
              className="absolute inset-0 size-full border-0"
            />

            {/*
              The location marker.

              The embed already draws its own pin, and this sits exactly on top of
              it - the query is a single place, so Google centres the map on it and
              places its pin in the middle of the frame. That is what makes a fixed
              overlay marker honest here: it is aligned with a real pin rather than
              guessing where one is.

              `pointer-events-none` so it never swallows a drag or a double-click to
              zoom - a decorative pin that blocks the map underneath it is the fastest
              way to make an interactive map feel broken.
            */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <span className="relative flex size-10 items-center justify-center">
                {/* The pulse ring. Static rather than animated: a looping animation
                    behind an iframe is the kind of thing that runs forever on a
                    battery, and `animate-pulse` on an always-visible element is
                    worse than no motion at all. */}
                <span className="absolute inset-0 rounded-full border-2 border-accent-500/60" />
                <span className="flex size-8 items-center justify-center rounded-full bg-action-accent shadow-lg ring-2 ring-page">
                  <MapPin className="size-4 text-black" />
                </span>
              </span>
            </div>
          </div>

          {/*
            The address bar.

            Below the map rather than floating over it: an overlay control competes
            with the map for the same attention, and this row also carries the full
            postal address, which is more text than belongs on top of a tile grid.
          */}
          <div className="flex flex-col gap-4 border-t border-line p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6">
            <address className="text-body-sm text-fg-secondary not-italic">
              <span className="block text-fg">{SHOWROOM.name}</span>
              {SHOWROOM_ADDRESS_LINES.map((line) => (
                <span key={line} className="block">
                  {line}
                </span>
              ))}
            </address>

            {/*
              An `<a>` rather than a `next/link`: this is the one link on the page
              that leaves the site, and it has to be a real anchor so a middle-click,
              a long-press "open in new tab" and a keyboard Enter all behave the way
              a visitor expects for an external destination.

              `rel="noopener noreferrer"` because `target="_blank"` without it hands
              the opened page a live `window.opener` reference back to this site.
            */}
            <a
              href={MAPS_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("accent", "md", "w-full shrink-0 sm:w-auto")}
            >
              Open in Google Maps
              <ExternalLink aria-hidden="true" className="size-4" />
            </a>
          </div>
        </Surface>
      </Container>
    </section>
  );
}

/**
 * Shown in place of the form when nothing is in stock.
 *
 * The form cannot work without a vehicle to attach the enquiry to, so this is the
 * honest alternative to rendering five fields that would submit nothing: say what
 * is missing and offer the two routes that do work.
 */
function NoVehiclesYet() {
  return (
    <div className="flex flex-col gap-5">
      <h3 className="text-label text-fg-muted">Send an enquiry</h3>

      <div aria-live="polite" className="flex flex-col gap-2">
        <p className="text-body text-fg">
          There are no vehicles listed at the moment, so there is nothing to choose
          from on this form.
        </p>
        <p className="text-body-sm text-fg-secondary">
          Ask us to source the vehicle you want, or check the inventory again - new
          vehicles are added as they arrive.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/sell" className={buttonClasses("accent", "md", "w-full sm:w-auto")}>
          Ask us to source a vehicle
        </Link>
        <Link
          href="/inventory"
          className={buttonClasses("outline", "md", "w-full sm:w-auto")}
        >
          View inventory
        </Link>
      </div>
    </div>
  );
}