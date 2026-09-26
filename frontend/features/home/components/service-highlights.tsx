import { Car, FileText, Globe, Search } from "@/components/icons";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";

/**
 * The first conversion section: what the business actually does.
 *
 * ---------------------------------------------------------------------------
 * Why this is a service list and not a statistics band
 * ---------------------------------------------------------------------------
 * The obvious thing to put here is a row of counters - "12 years trading",
 * "500 vehicles exported", "40 destination countries". Every one of those is a
 * fabricated claim until the business supplies it, and a counter is the single
 * most common way a generated site ends up quietly lying. It is also the easiest
 * thing for a visitor to check and find false, which costs more trust than an
 * empty band would.
 *
 * So the section describes services instead. Each of the four is drawn from the
 * site's own information architecture in `navigation/config.ts` - the Vehicles,
 * Sell/Source and Export groups - so this is a description of the business
 * rather than a claim about it. Nothing here needs a number to be true.
 *
 * ---------------------------------------------------------------------------
 * Why the cards are not links
 * ---------------------------------------------------------------------------
 * `/inventory`, `/brands`, `/compare` and `/export` are all `planned` in the
 * navigation config: the routes do not exist. Making these cards links is the
 * single most likely way to reintroduce the dead links Step 3 removed, so they
 * are deliberately non-interactive. The route that will eventually own each
 * card's detail can be wired up in one line when it lands.
 *
 * The enquiry route stays with the hero, which is where a visitor who wants to
 * act on any of this already has the button.
 */

const SERVICES = [
  {
    id: "sales",
    icon: Car,
    title: "Vehicle sales",
    body: "Buy from our Ras Al Khor showroom in Dubai, or tell us the vehicle you need and we will confirm what is available.",
  },
  {
    id: "sourcing",
    icon: Search,
    title: "Vehicle sourcing",
    body: "Name a make, model, year and budget, and we will source the vehicle on your behalf rather than leaving you to search alone.",
  },
  {
    id: "export",
    icon: Globe,
    title: "International export",
    body: "We export vehicles to buyers outside the UAE, arranging the shipment to your destination country.",
  },
  {
    id: "documentation",
    icon: FileText,
    title: "Export documentation",
    body: "The paperwork an imported vehicle needs, handled as part of the export rather than as an afterthought.",
  },
] as const;

export function ServiceHighlights() {
  return (
    <section
      // The hero's secondary CTA points here, so the id is load-bearing: rename
      // it and that button silently stops scrolling anywhere.
      id="services"
      // The anchor target has to be programmatically focusable. Following an
      // in-page link scrolls the viewport, but without `tabIndex={-1}` the
      // keyboard focus stays behind on the CTA, so the next Tab jumps back up
      // to the top of the hero and the jump looks like it never happened.
      tabIndex={-1}
      aria-labelledby="services-heading"
      className="scroll-mt-24 border-t border-line bg-sunken focus:outline-none"
    >
      <Container className="py-16 md:py-20 lg:py-24">
        {/*
          `align="start"` (the default) rather than a centred heading. Centred
          section headers are the default in most templates; left-aligned reads
          as more editorial and matches the hero, which is the point of a
          consistent left edge down the page.
        */}
        <SectionHeading
          eyebrow="What we do"
          title="From showroom floor to destination country"
          description="Humera Automobile handles both halves of buying a vehicle in Dubai and getting it out of the country."
        />

        {/*
          One column on mobile, two from `sm`, four from `lg`.

          Four across is the most that stays readable at this measure - a fifth
          would force the cards below ~200px, at which point the body text wraps
          to four or five lines and the row stops scanning as a set.
        */}
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:mt-12 lg:grid-cols-4">
          {SERVICES.map((service) => {
            const Icon = service.icon;

            return (
              <li key={service.id} className="min-w-0">
                {/*
                  `as="article"` gives each card a landmark-free but still
                  meaningful grouping. The heading is a real `h3`, so the page
                  outline is h1 (hero) > h2 (this section) > h3 (each service) -
                  which is what lets a screen-reader user jump between services
                  from the heading list.
                */}
                <Surface
                  as="article"
                  className="flex h-full flex-col gap-3.5 p-5 transition-[border-color,box-shadow] duration-[var(--duration-base)] hover:border-line-strong hover:shadow-md"
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-sm border border-line bg-page text-accent-600 dark:text-accent-400"
                  >
                    <Icon className="size-5" />
                  </span>

                  {/*
                    `level={3}` because this heading is nested inside the
                    section's `h2`. Getting this wrong breaks the outline, which
                    is the single most useful structure a screen reader user has.
                  */}
                  <SectionHeading level={3} title={service.title} />

                  <p className="text-body-sm text-fg-secondary">{service.body}</p>
                </Surface>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
