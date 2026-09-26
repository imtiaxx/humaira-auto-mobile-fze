import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";

/**
 * The discovery area: what to tell us when you want a vehicle sourced.
 *
 * ---------------------------------------------------------------------------
 * Why this is information and not a filter bar
 * ---------------------------------------------------------------------------
 * The obvious thing to build here is a row of dropdowns - make, body type, fuel,
 * price range - above the results grid. It is also the one thing that cannot be
 * built yet.
 *
 * With no published inventory, a set of filters has nothing to filter. It can
 * only sit there looking operable, and a visitor who opens it, chooses a make
 * and gets an unchanged empty grid has been told the site is broken. Worse, it
 * hard-codes a promise about what the catalogue will eventually contain - that
 * there will be a searchable set of makes, a price range, a fuel taxonomy -
 * which is a decision for when there is real stock to categorise, not now.
 *
 * So this section states the four things the business already says it works to
 * - make, model, year, budget - as a plain specification list. It is the actual
 * discovery mechanism available today: a person reads it, then uses the enquiry
 * route at the foot of the page. When inventory is published, this becomes a
 * real control set and the `VehicleFilters` interface in `types/vehicle.ts` is
 * already the shape it will take.
 *
 * The four criteria and the wording around them are the ones the homepage
 * already uses ("By make, model and budget") and that the navigation already
 * models as "Request a Vehicle", so this section describes the service the site
 * claims rather than inventing a second description of it.
 */
const CRITERIA: readonly { label: string; detail: string }[] = [
  {
    label: "Make",
    detail: "The brand, or the marque the vehicle is sold under.",
  },
  {
    label: "Model",
    detail: "The model name, and the variant or trim if you have one in mind.",
  },
  {
    label: "Year",
    detail: "A minimum year, or a specific model year.",
  },
  {
    label: "Budget",
    detail: "The range you are working to, in AED.",
  },
];

export function SourcingCriteria() {
  return (
    <section
      aria-labelledby="sourcing-heading"
      className="border-b border-line bg-sunken"
    >
      <Container className="py-16 sm:py-20">
        <SectionHeading
          eyebrow="Sourcing"
          title="Tell us what you are looking for"
          description="Humera Automobile sources across the Dubai market rather than from a single seller, so a vehicle can often be found when it is not the one we have in the showroom. Four details are enough for us to start."
        />

        {/*
          A description list rather than a set of styled boxes. These are
          term/definition pairs, which is exactly what `<dl>` means, and it means
          a screen reader hears "Make: the brand, or the marque..." as a labelled
          pair rather than as two unconnected fragments.

          The grid collapses to one column, then two, then four, and the rules
          are a single top border on the list rather than one per cell. Hairlines
          between every cell would need `:nth-child` arithmetic to avoid doubling
          up at each breakpoint, and that is exactly the kind of clever markup
          that breaks silently the next time an item is added or reordered - so
          the section gets one structural rule and lets the spacing do the rest.
        */}
        <dl className="mt-10 grid grid-cols-1 gap-x-8 gap-y-8 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-4">
          {CRITERIA.map(({ label, detail }) => (
            <div key={label} className="flex flex-col gap-1.5">
              <dt className="text-label text-fg-accent uppercase">{label}</dt>
              <dd className="text-body-sm text-fg-secondary">{detail}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
