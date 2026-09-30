import { WhatsAppCta } from "@/components/cta/whatsapp-cta";
import { Container } from "@/components/ui/container";

/**
 * The Sell / Source page.
 *
 * ---------------------------------------------------------------------------
 * What this page is
 * ---------------------------------------------------------------------------
 * The two services the business sells that are not a vehicle in stock: taking one
 * in, and finding one out. `navigation/config.ts` has carried a `planned` "Sell /
 * Source" entry at `/sell` since the information architecture was written, and this
 * is the page that promotes it to `live`.
 *
 * A Server Component with no state, no fetching and no event handlers. Nothing on
 * the page needs to know when anything happened, so it ships no client JavaScript
 * at all - the same trade `inventory-cta.tsx` makes.
 *
 * ---------------------------------------------------------------------------
 * Why both cards lead to the same conversation
 * ---------------------------------------------------------------------------
 * There is one enquiry route on this site and it is WhatsApp, configured through
 * `NEXT_PUBLIC_WHATSAPP_NUMBER`. Both cards therefore use `unavailable="disabled"`
 * rather than the default `"hidden"`, so that until a number is confirmed they show
 * an explicitly unavailable control carrying `aria-disabled` instead of rendering
 * nothing.
 *
 * That matters more here than anywhere else on the site. Every other page is about
 * browsing stock, and a missing contact button there is unremarkable. This page
 * *is* the contact page for two services, so an empty card with no call to action
 * would read as a build that shipped without its point.
 *
 * The messages are pre-filled and distinct, so a customer who taps "sell" does not
 * land in a conversation that has to establish which of the two services they want.
 * That is the whole reason the two cards exist as separate paths rather than one
 * "Contact us" button.
 *
 * ---------------------------------------------------------------------------
 * Why this is not an enquiry form
 * ---------------------------------------------------------------------------
 * A form would be the obvious choice and it is deliberately not used. The backend
 * enquiry endpoint is real and does work, but it is bound to a *vehicle*: an
 * enquiry record is about a specific car, and its schema and the staff interface
 * that reads it are both written around a vehicle reference. Wiring a
 * "sell your car" or "source a vehicle" submission into it would mean either
 * inventing a vehicle to attach the enquiry to, or changing a data model - and
 * both are well outside a page's remit, and the first would put fabricated rows in
 * the staff inbox.
 *
 * So this page routes to the conversation, and the enquiry record stays
 * trustworthy.
 */

/**
 * The two services, as data rather than as duplicated JSX.
 *
 * Held here so the two cards cannot drift apart in structure or spacing - the
 * failure mode of writing a "ServiceCard" twice and then fixing only one of them.
 */
const SERVICES = [
  {
    id: "sell",
    /**
     * A numeral, not the service name.
     *
     * The card's heading and its call to action are both specified as "SELL YOUR
     * CAR", so putting the service name above them as well would say it three times
     * in three type sizes. A numeral gives the red accent the design needs and
     * marks the two cards as a set without restating the label.
     */
    index: "01",
    title: "Sell your car",
    body: "Looking to sell your vehicle? Share your vehicle details with us and our team will review your request.",
    cta: "Sell your car",
    message:
      "Hello Humera Automobile, I would like to sell my vehicle and would like to share its details with your team.",
  },
  {
    id: "source",
    index: "02",
    title: "Source a vehicle",
    body: "Looking for a specific vehicle? Tell us what you're looking for and we'll help source the right vehicle for you.",
    cta: "Source a vehicle",
    message:
      "Hello Humera Automobile, I am looking to source a specific vehicle and would like to tell your team what I have in mind.",
  },
] as const;

export function SellSource() {
  return (
    <>
      {/*
        The hero.

        `bg-page` rather than a second surface: this page is a single dark scope
        from top to bottom, and the sections are separated by rhythm and by their
        own borders rather than by alternating backgrounds. Alternating bands on a
        page this short would make it feel like a brochure.

        The red hairline is the one ornament, and it is the same device the
        homepage hero and the inventory conversion panel use - a short rule that
        marks the start of a section without needing a label. Reusing it is what
        makes this page read as part of the same site.
      */}
      <section aria-labelledby="sell-heading" className="relative overflow-hidden bg-page">
        {/*
          A single soft accent wash in the top corner, at low opacity.

          It exists to stop the upper third reading as flat black, which is what an
          untextured `bg-page` does at this size. It is `aria-hidden`, it is behind
          everything, and it is the same radial the homepage hero uses.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_15%_0%,color-mix(in_oklab,var(--color-accent-500)_12%,transparent),transparent_70%)]"
        />

        <Container className="relative py-20 sm:py-24 lg:py-32">
          <div className="flex max-w-3xl flex-col gap-6">
            <span
              aria-hidden="true"
              className="block h-0.5 w-14 rounded-full bg-action-accent"
            />

            {/*
              The page's only `h1`.

              `text-display` is the design system's largest step and this is the one
              page that earns it: the hero line is the thing being said, and there
              is no image competing for the first screen. Uppercase with the token's
              own negative tracking - a wide-tracked display setting breaks the word
              shapes apart, and this sentence is a phrase rather than a nameplate.
            */}
            <h1
              id="sell-heading"
              className="animate-fade-up text-display text-fg uppercase text-balance"
            >
              Sell or source your next vehicle
            </h1>

            {/*
              The supporting sentence.

              `text-fg-secondary` rather than muted: this is the only body copy in
              the hero and it carries the actual explanation of the page, so it
              should be the second thing read clearly rather than the third thing
              read faintly. Capped at `max-w-2xl` so the measure stays readable
              instead of running the full width of a wide screen.
            */}
            <p className="animate-fade-up max-w-2xl text-pretty text-body-lg text-fg-secondary [animation-delay:120ms]">
              Whether you&rsquo;re selling a vehicle or looking for a specific car,
              Humera Automobile helps make the process simple and professional.
            </p>
          </div>
        </Container>
      </section>

      {/*
        The two services.

        A bordered section rather than two floating cards on the page background,
        so the cards read as a set - they are alternatives offered side by side, and
        a viewer choosing between them should see them as peers. The top border is
        the page's structural line; everything below it is one treatment.
      */}
      <section
        aria-labelledby="sell-services-heading"
        className="border-t border-line bg-page"
      >
        <Container className="py-20 sm:py-24">
          <h2 id="sell-services-heading" className="sr-only">
            Choose a service
          </h2>

          <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
            {SERVICES.map((service) => (
              <article
                key={service.id}
                className="group flex flex-col gap-5 rounded-card border border-line bg-raised p-8 transition-colors duration-[var(--duration-base)] ease-[var(--ease-standard)] hover:border-accent-500/40 sm:p-10"
              >
                <div className="flex flex-col gap-3">
                  {/*
                    The numeral marker. `text-fg-accent` is the pale end of the red
                    ramp, the step that clears 8.8:1 on a raised near-black surface -
                    the vivid `accent-500` is 4.9:1 and is a fill colour, not a text
                    colour. `tabular-nums` keeps the pair aligned if the numerals
                    were ever more than two digits.

                    The rule beside it echoes the hero's hairline, so the two halves
                    of the page are visibly the same design.
                  */}
                  <p className="flex items-center gap-3 text-label text-fg-accent">
                    <span aria-hidden="true" className="h-px w-8 bg-accent-500" />
                    <span className="tabular-nums">{service.index}</span>
                  </p>

                  <h3 className="text-h3 text-fg text-balance">{service.title}</h3>
                </div>

                <p className="max-w-md text-pretty text-body text-fg-secondary">
                  {service.body}
                </p>

                {/*
                  The call to action, pushed to the bottom of the card.

                  `mt-auto` on a flex child, inside a `flex-col` article, is what
                  makes the two buttons align with each other across the pair even
                  though the two body paragraphs are different lengths. Without it
                  the shorter card's button sits higher and the set looks accidental.

                  `variant="accent"` - the brand red fill, white type, 4.9:1. The one
                  element in each card allowed to be loud, because it is the action
                  the whole page exists to produce.
                */}
                <div className="mt-auto pt-4">
                  <WhatsAppCta
                    label={service.cta}
                    ariaLabel={`${service.cta} - contact Humera Automobile on WhatsApp`}
                    message={service.message}
                    unavailable="disabled"
                    variant="accent"
                    size="lg"
                    className="w-full sm:w-auto"
                  />
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>
    </>
  );
}
