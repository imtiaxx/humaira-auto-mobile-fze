import Link from "next/link";

import { Car, Globe, Search, ShieldCheck } from "@/components/icons";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button-styles";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";
import { SITE_DESCRIPTION } from "@/config/site";

/**
 * The About page.
 *
 * ---------------------------------------------------------------------------
 * The rule this page is written under
 * ---------------------------------------------------------------------------
 * There is no invented fact anywhere in it: no years in business, no units sold, no
 * customer count, no rating, no award, no accreditation, no testimonial, no
 * "trusted by thousands". Every sentence is either one the business supplied, or
 * one traceable to this repository.
 *
 * That is a deliberate constraint rather than an absence of ambition, and it is
 * the same rule `config/site.ts` enforces for contact details - a file whose own
 * docstring says "Do not 'temporarily' fill one in to get a layout to look
 * finished." An About page is where invented claims do the most damage, because
 * it is the page a competitor reads to find something they can disprove, and
 * because a fabricated figure is indistinguishable from a real one to the next
 * person who reads the code.
 *
 * So the value propositions below are written as *commitments* - what the business
 * stands for - rather than as achievements. "We publish the price of every vehicle
 * we list" is a policy that is true the moment it is written. "Over 500 vehicles
 * sold" is a fact that has to be verified before anyone types it.
 *
 * The one established fact used is `SITE_DESCRIPTION`, which is the site's own
 * verified one-liner. The About page is the one page that should carry that
 * sentence in full rather than paraphrasing it.
 *
 * ---------------------------------------------------------------------------
 * Why a Server Component
 * ---------------------------------------------------------------------------
 * Nothing here fetches, filters, or holds state - it is the whole page, and it is
 * static copy. So it ships no client JavaScript at all, the same trade
 * `service-highlights.tsx` and `sell-source.tsx` make.
 */

/**
 * The four things the business does, as data.
 *
 * The wording follows `SITE_DESCRIPTION` - a vehicle sales and international
 * export business in Dubai - and the services the site already models in
 * `navigation/config.ts` (Inventory, Sell / Source, Export). It does not introduce
 * categories the rest of the site does not use, because an About page that
 * paraphrases its own navigation into different words is harder to trust, not
 * easier.
 */
const OFFERINGS = [
  {
    id: "selection",
    title: "Vehicle selection",
    body: "The vehicles held at our Ras Al Khor showroom, listed with the year, mileage, specification and published price recorded against each one, so you can judge a car before you travel to see it.",
    icon: Car,
  },
  {
    id: "sourcing",
    title: "Vehicle sourcing",
    body: "If the vehicle you want is not on our lot, tell us the make, model, year and budget you are working to and we will look for it across the Dubai market on your behalf.",
    icon: Search,
  },
  {
    id: "service",
    title: "Professional service",
    body: "One point of contact from your first message through to handover, with the details of the vehicle and the terms of the sale agreed in writing before anything changes hands.",
    icon: ShieldCheck,
  },
  {
    id: "global",
    title: "Global automotive focus",
    body: "Vehicles sold from Dubai to buyers in other countries, with the transport and the export documentation that move a vehicle out of the UAE handled as part of the sale.",
    icon: Globe,
  },
] as const;

/**
 * How we work.
 *
 * Three words, given by the business, expanded into what each one actually means
 * in practice. A principle with no consequence attached is a slogan, so each entry
 * describes a behaviour rather than an attitude.
 */
const APPROACH = [
  {
    id: "simple",
    title: "Simple",
    body: "One conversation, in plain language. You get a straight answer to what a vehicle costs and what is known about its condition, without a list of options to choose between.",
  },
  {
    id: "transparent",
    title: "Transparent",
    body: "The specifications and the price are published against each vehicle rather than held back until you enquire, and anything we do not know about a car is not presented as though we do.",
  },
  {
    id: "professional",
    title: "Professional",
    body: "The same care whether you are buying the first vehicle you have ever owned or your fifth, and the same care whether the vehicle is for this country or for export.",
  },
] as const;

/** Why choose us. Three commitments, again as policy rather than as record. */
const REASONS = [
  {
    id: "quality",
    title: "Quality first",
    body: "We would rather hold a smaller selection than list a vehicle we would not put a customer behind. What is on our lot is what we would be willing to sell or to buy.",
  },
  {
    id: "transparency",
    title: "Transparency",
    body: "The price and the details of a vehicle are published, not revealed on request. If a figure is negotiable we will tell you it is negotiable rather than presenting it as fixed.",
  },
  {
    id: "focus",
    title: "Customer focus",
    body: "You are dealing with the company supplying the vehicle rather than a broker passing it on, and your enquiry is answered by a person who can act on it.",
  },
] as const;

export function AboutPageBody() {
  return (
    <>
      {/*
        The hero.

        `bg-page`, matching `/sell` and the rest of the dark scope. The single red
        hairline is the site's established section marker - the same device the
        homepage hero and the inventory conversion panel use - and reusing it is
        what makes this page read as part of the same site rather than as a
        template.
      */}
      <section aria-labelledby="about-heading" className="relative overflow-hidden bg-page">
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

              "Premium Vehicles. Professional Service." is the position statement
              the business gave for this page, so it is the heading rather than the
              word "About" - the section is identified by `aria-labelledby` and by
              the navigation, and the visible line should be the one that says
              something.

              `text-display` is the largest step in the type scale and this is the
              one page that earns it: there is no photograph competing for the
              first screen, and the line is short enough to hold at 72px. Uppercase
              with the token's own negative tracking; a wide-tracked display setting
              would pull "PROFESSIONAL" apart.
            */}
            <h1 id="about-heading" className="animate-fade-up text-display text-fg uppercase text-balance">
              Premium vehicles. Professional service.
            </h1>

            {/*
              The verified one-liner, carried in full from `SITE_DESCRIPTION` rather
              than rewritten. It is the only sentence on the page that states what
              the business *is* as a matter of record, so it is quoted rather than
              paraphrased - and importing it means a future correction to the
              business's own description cannot leave this page contradicting it.

              `text-fg-secondary` and a capped measure: this is the second thing
              read, and it should be clear rather than faint.
            */}
            <p className="animate-fade-up max-w-2xl text-pretty text-body-lg text-fg-secondary [animation-delay:120ms]">
              {SITE_DESCRIPTION}
            </p>
          </div>
        </Container>
      </section>

      {/*
        Our approach.

        `bg-sunken` rather than `bg-page`. This is the one band on the page that
        steps off the default canvas, and it earns it: the approach is the
        explanation and the offer is the evidence, so separating them by surface
        rather than by a hairline alone gives the page a rhythm without needing
        photography to do it.
      */}
      <section aria-labelledby="approach-heading" className="border-t border-line bg-sunken">
        <Container className="py-20 sm:py-24 lg:py-28">
          <SectionHeading
            titleId="approach-heading"
            eyebrow="Our approach"
            title="Simple, transparent, professional vehicle buying"
            description="Three words, and what each one commits us to doing."
          />

          <ul className="mt-12 grid gap-5 md:grid-cols-3">
            {APPROACH.map(({ id, title, body }) => (
              <li key={id} className="flex">
                {/*
                  `Surface` rather than a bespoke panel, so these three inherit the
                  same border, radius and shadow as every other card on the site.

                  The red rule above each title is the section's accent, repeated
                  three times so the eye is carried across the row. `aria-hidden`
                  because it is decoration and three copies of it in the
                  accessibility tree would be noise.
                */}
                <Surface as="article" className="flex w-full flex-col gap-3 rounded-card p-6 sm:p-8">
                  <span aria-hidden="true" className="block h-0.5 w-10 rounded-full bg-action-accent" />
                  <h3 className="text-h3 text-fg">{title}</h3>
                  <p className="text-body-sm text-fg-secondary">{body}</p>
                </Surface>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/*
        What we offer.

        Four cards, the same count and the same kind of grid `service-highlights`
        uses on the homepage. They cover the same ground - selection, sourcing,
        service, export - because they are the same business, described twice for
        two different readers. The homepage version answers "what do you do" in one
        scan; this one says what each service actually involves.
      */}
      <section aria-labelledby="offerings-heading" className="border-t border-line bg-page">
        <Container className="py-20 sm:py-24 lg:py-28">
          <SectionHeading
            titleId="offerings-heading"
            eyebrow="What we offer"
            title="What Humera Automobile does"
            description="Four services, covering both halves of buying a vehicle in Dubai: the car itself, and getting it to the country you are buying from."
          />

          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {OFFERINGS.map(({ id, title, body, icon: Icon }) => (
              <li key={id} className="flex">
                {/*
                  The icon plate: a flat bordered square in the accent tone, the
                  same treatment `service-highlights` uses. A filled plate would put
                  four blocks of colour in the middle of an otherwise monochrome
                  block and compete with the section heading.

                  `text-fg-accent` resolves to `accent-300`, which clears 8.7:1 on
                  the raised surface. The raw `accent-500` is 3.9:1 as type on
                  near-black and would be a poor trade for a decorative glyph.
                */}
                <Surface as="article" className="flex w-full flex-col gap-4 rounded-card p-6">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-10 items-center justify-center rounded-sm border border-line text-fg-accent"
                  >
                    <Icon className="size-5" />
                  </span>

                  <h3 className="text-h3 text-fg">{title}</h3>
                  <p className="text-body-sm text-fg-secondary">{body}</p>
                </Surface>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/*
        Why Humera Automobile?

        Three commitments rather than three achievements, for the reason in the
        module docstring. `bg-sunken` again, alternating with the band above, so
        the page has two light-dark steps instead of one long dark field.
      */}
      <section aria-labelledby="reasons-heading" className="border-t border-line bg-sunken">
        <Container className="py-20 sm:py-24 lg:py-28">
          <SectionHeading
            titleId="reasons-heading"
            eyebrow="Why Humera Automobile?"
            title="What we hold ourselves to"
            description="Three commitments that decide which vehicles we list and how we handle the ones we do."
          />

          <ul className="mt-12 grid gap-5 md:grid-cols-3">
            {REASONS.map(({ id, title, body }, index) => (
              <li key={id} className="flex">
                {/*
                  A numeral rather than a repeated icon. Three icons from the same
                  set, chosen to mean three different things, is a way of implying
                  the three commitments are distinct *capabilities*. They are not -
                  they are three positions, and a numeral says that without
                  pretending. `tabular-nums` keeps the row aligned.
                */}
                <Surface as="article" className="flex w-full flex-col gap-3 rounded-card p-6 sm:p-8">
                  <p aria-hidden="true" className="text-label tabular-nums text-fg-accent">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="text-h3 text-fg">{title}</h3>
                  <p className="text-body-sm text-fg-secondary">{body}</p>
                </Surface>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/*
        Our vision.

        One statement, given the largest type on the page after the `h1`, on the
        default canvas with a single top hairline. It is deliberately the shortest
        section: a vision that needs three paragraphs is not a vision, and padding
        it out would dilute the one sentence that carries it.
      */}
      <section aria-labelledby="vision-heading" className="border-t border-line bg-page">
        <Container className="py-20 sm:py-24 lg:py-28">
          <div className="flex max-w-4xl flex-col gap-6">
            {/*
              No `eyebrow` here, unlike every other section on the page. The name
              "Our vision" is short enough to carry the section as a visible heading
              in its own right, and prefixing it with a second red label above
              another red label would be decoration stacked on decoration.

              The statement below it is set larger than any body copy on the page and
              only smaller than the `h1`, because it is the one sentence the section
              exists to deliver.
            */}
            <SectionHeading titleId="vision-heading" title="Our vision" />
            <p className="text-balance text-2xl leading-[1.2] font-semibold tracking-[-0.02em] text-fg sm:text-3xl">
              To build a trusted automotive name through quality vehicles and
              professional service.
            </p>
          </div>
        </Container>
      </section>

      {/*
        The closing call to action.

        Two buttons, and the choice between them is the point: one visitor wants to
        look at stock, the other wants to sell theirs or find a specific car. Both
        routes are `live` in `navigation/config.ts` - `/inventory` and `/sell` - so
        unlike the homepage's service cards these are real links and get real
        `next/link` navigation. No dead promise.

        `border-accent-500/40` on the panel: a permanent red-tinted edge marks this
        as the action area without a second filled red competing with the primary
        button inside it.
      */}
      <section aria-labelledby="about-cta-heading" className="border-t border-line bg-sunken">
        <Container className="py-20 sm:py-24">
          <Surface className="flex flex-col gap-8 rounded-card border-accent-500/40 p-6 sm:p-10 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
            <div className="flex max-w-2xl flex-col gap-3">
              <h2 id="about-cta-heading" className="text-h2 text-fg text-balance">
                Looking for your next vehicle?
              </h2>
              <p className="text-body text-fg-secondary">
                Browse what we have in stock now, or tell us the vehicle you want to
                sell or the one you are looking for.
              </p>
            </div>

            {/*
              `buttonClasses` applied to a `next/link` rather than a `<Button>`.

              `Button` renders a real `<button>` with no `asChild`, so putting an
              anchor inside one is invalid HTML and gives the link the wrong
              semantics. This is the pattern `whatsapp-cta.tsx` already uses for a
              link styled as a button, and it keeps the shared recipes as the one
              source of button appearance.

              `accent` is the primary action and `outline` the secondary, so there
              is exactly one filled red on the page's closing panel.
            */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/inventory"
                className={buttonClasses("accent", "lg", "w-full sm:w-auto")}
              >
                View inventory
              </Link>
              <Link
                href="/sell"
                className={buttonClasses("outline", "lg", "w-full sm:w-auto")}
              >
                Sell / source a vehicle
              </Link>
            </div>
          </Surface>
        </Container>
      </section>
    </>
  );
}
