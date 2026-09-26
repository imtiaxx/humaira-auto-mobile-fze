import { WhatsAppCta } from "@/components/cta/whatsapp-cta";
import { Car, Globe, Search, Truck } from "@/components/icons";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";

/**
 * The services block: the homepage's answer to "what do you actually do, and
 * can you help me with my situation".
 *
 * The four cards are the customer journey in the order a buyer or seller meets
 * it, and the names are the ones the site already uses in its own navigation
 * config - Vehicles, Sell / Source, Export - rather than invented marketing
 * categories. Keeping the same words the header uses means the section explains
 * the site rather than paraphrasing it.
 *
 * Every sentence is traceable to the repository:
 *
 * - Buying and exporting vehicles in Dubai is the site's own one-line
 *   description in `config/site.ts`.
 * - The showroom address comes from the same config, so it cannot drift from
 *   the footer.
 * - Sourcing by make, model, year and budget is the request the navigation
 *   already models as "Sell / Source a Car" and "Request a Vehicle".
 * - Shipping and documentation are the two items the navigation lists under
 *   Export.
 *
 * There is no invented figure anywhere: no units sold, no customer count, no
 * turnaround time, no rating, no accreditation. On a site whose only real
 * differentiator is that a named person answers the message, a row of invented
 * counters is exactly the thing a competitor could disprove on their first
 * email.
 *
 * These cards are deliberately NOT links. The routes they describe
 * (`/inventory`, `/export`, `/request-a-vehicle`) are declared `planned` in
 * `navigation/config.ts` and do not exist, so linking them would put a 404
 * behind the most important block on the page. For the same reason the cards
 * carry no hover treatment: a card that shifts and deepens its shadow on hover
 * reads as clickable, and promising a click that 404s is worse than not
 * looking clickable at all. When those routes ship, each card gains a link and
 * the hover state with it.
 *
 * No state and no event handlers, so this is a Server Component and ships no
 * JavaScript.
 */

type Service = {
  /** Stable key. Not shown to the user. */
  id: string;
  title: string;
  /** Short factual qualifier, sitting under the title. */
  label: string;
  body: string;
  icon: typeof Car;
};

const SERVICES: Service[] = [
  {
    id: "vehicles",
    title: "Vehicles",
    label: "Showroom sales in Dubai",
    body: "The cars held at our Ras Al Khor showroom, sold directly by the company supplying them rather than through a broker.",
    icon: Car,
  },
  {
    id: "source",
    title: "Source a vehicle",
    label: "By make, model and budget",
    body: "Tell us the make, model, year and budget you are working to, and we will look for it across the Dubai market.",
    icon: Search,
  },
  {
    id: "export",
    title: "Export worldwide",
    label: "For buyers outside the UAE",
    body: "Vehicles exported from Dubai to buyers in other countries, arranged from the UAE side.",
    icon: Globe,
  },
  {
    id: "shipping",
    title: "Shipping and documentation",
    label: "Handled as part of the export",
    body: "The transport and the export documents that move a vehicle out of the UAE and travel with it to the buyer.",
    icon: Truck,
  },
];

/**
 * The section's visible heading, held in one place because it is used twice:
 * once as the `h2`, once as the region name.
 *
 * `SectionHeading` renders the heading but exposes no `id`, so `aria-labelledby`
 * is not available without changing a shared component. Naming the region with
 * the same string instead keeps the accessible name and the visible heading
 * identical, which is what WCAG "Label in Name" asks for - and sharing the
 * constant is what stops the two from drifting apart later.
 */
const SERVICES_HEADING = "Vehicles, sourcing and international export";

export function ServiceHighlights() {
  return (
    <section
      id="services"
      aria-label={SERVICES_HEADING}
      // The hero's secondary action points here. `tabIndex={-1}` makes that
      // link move focus instead of leaving the next Tab back at the top of the
      // page, so the section announces itself rather than scrolling silently.
      tabIndex={-1}
      // Step 6: this section stays on the light canvas on purpose. It is the
      // pale breath between two deep ones - the hero above and the conversion
      // panel below - and that alternation is what stops a page with no
      // photography from reading as one long undifferentiated block. The hairline
      // is what carries the transition; the colour change does the rest.
      className="scroll-mt-24 overflow-hidden border-t border-line bg-sunken focus:outline-none"
    >
      <Container className="py-16 sm:py-20 lg:py-28">
        <SectionHeading
          eyebrow="What we offer"
          title={SERVICES_HEADING}
          description="Humera Automobile handles both halves of buying a vehicle in Dubai: the car itself, and getting it to the country you are buying from."
        />

        <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map(({ id, title, label, body, icon: Icon }) => (
            <li key={id} className="flex">
              <Surface
                as="article"
                className="flex w-full flex-col gap-4 rounded-card border-line p-6"
              >
                {/*
                  Step 6: the icon plate is a flat bordered square rather than a
                  filled one. A tinted plate put four small blocks of colour in
                  the middle of an otherwise monochrome block, which competed
                  with the section heading for attention. Outlined, in the accent
                  tone, it reads as a considered marker and gives each card a
                  recognisable anchor point without adding a second colour.
                */}
                <span
                  aria-hidden="true"
                  className="inline-flex size-10 items-center justify-center rounded-sm border border-line text-fg-accent"
                >
                  <Icon className="size-5" />
                </span>

                <div className="flex flex-col gap-1.5">
                  <h3 className="text-h3 text-fg">{title}</h3>
                  <p className="text-label text-fg-muted">{label}</p>
                </div>

                <p className="text-body-sm text-fg-secondary">{body}</p>
              </Surface>
            </li>
          ))}
        </ul>

        {/*
          Step 6: the conversion panel moves onto the deep canvas.

          This is the one panel on the page whose entire job is to be acted on,
          so it now sits on the same near-black as the hero and the brass CTA
          gains the strongest contrast pairing available on the site. Placing it
          at the end of the light section also gives the page a deliberate shape
          - dark arrival, light information, dark action - rather than three
          stacked boxes that happen to share a border.

          The `on-inverse` scope does the work: the heading, the paragraph and
          the shared `WhatsAppCta` below are unchanged code and simply resolve
          against the deep tokens.
        */}
        <Surface
          as="div"
          className="on-inverse mt-12 flex flex-col gap-6 rounded-card border-line bg-page p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10"
        >
          <div className="flex max-w-2xl flex-col gap-2">
            <h3 className="text-h3 text-fg">Not sure which one applies?</h3>
            <p className="text-body text-fg-secondary">
              Tell us the vehicle you are looking for, or the one you want to
              sell, and we can point you to the right service.
            </p>
          </div>

          {/* The one enquiry path for the whole page. Reuses the shared CTA so
              the WhatsApp number stays in one place, comes from the
              environment, and is never written into the markup by hand. */}
          <WhatsAppCta
            label="Enquire on WhatsApp"
            ariaLabel="Enquire on WhatsApp"
            message="Hello Humera Automobile, I would like to enquire about your services."
            unavailable="disabled"
            variant="accent"
            size="lg"
            className="shrink-0 self-start lg:self-center"
          />
        </Surface>
      </Container>
    </section>
  );
}
