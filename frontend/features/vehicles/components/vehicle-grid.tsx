import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { EmptyState } from "@/components/ui/states";
import { VehicleCard } from "@/features/vehicles/components/vehicle-card";
import type { Vehicle } from "@/types/vehicle";

/**
 * The results area: the vehicle grid, or an honest account of it being empty.
 *
 * ---------------------------------------------------------------------------
 * Both branches are still the product
 * ---------------------------------------------------------------------------
 * The grid is what a visitor sees now that stock is published, and the empty
 * state remains a real branch: every vehicle can be archived, and a catalogue
 * whose last listing has been archived must still have something true to say.
 * It is written as a first-class state rather than a placeholder for one,
 * because the business trades whether or not anything is listed online.
 *
 * The wording is chosen carefully, because most empty states get this wrong in
 * one of two directions:
 *
 *   - "No vehicles available" would be a false claim. The showroom exists and
 *     the business trades; what is absent is *published listings*, not cars.
 *   - "Coming soon" would be vague, and vaguer than the truth. The site does
 *     not know when listings will appear, and promising a date is precisely the
 *     kind of invented information this repository refuses to ship.
 *
 * So it says what is actually true, and points at the thing that does work: a
 * person will find a vehicle by being told what to look for.
 *
 * ---------------------------------------------------------------------------
 * Reuse of the shared empty state
 * ---------------------------------------------------------------------------
 * `EmptyState` is the design system's existing block for "nothing here yet" -
 * its own documentation names "an empty inventory grid" as the case it was
 * written for. Reusing it means this page cannot grow a second, subtly different
 * treatment for the same situation, and when the empty results case later
 * arrives for a filtered search it is already the right component.
 *
 * No `action` is passed. `EmptyState` renders its action as a `<button>`, and
 * this is a Server Component - an `onClick` here would ship JavaScript to do
 * nothing, and the one action worth offering here (enquire) already exists as
 * the real, focusable conversion panel immediately below.
 */
export function VehicleGrid({
  vehicles,
  headingId = "listings-heading",
}: {
  vehicles: Vehicle[];
  /**
   * Wired to the heading so the region is named by its own visible title, and
   * passed through to `SectionHeading` so the referenced element actually
   * exists - an `aria-labelledby` pointing at nothing leaves the section with
   * no accessible name at all.
   */
  headingId?: string;
}) {
  const count = vehicles.length;

  return (
    <section aria-labelledby={headingId} className="bg-page">
      <Container className="py-16 sm:py-20">
        <SectionHeading
          titleId={headingId}
          eyebrow="Listings"
          title="Vehicles available now"
          className="scroll-mt-28"
          description={
            count > 0
              ? `${count} ${count === 1 ? "vehicle" : "vehicles"} published by Humera Automobile, each with its specification and its USD price. A vehicle with no published figure is marked price on request - ask for it and we will quote.`
              : "Vehicles published by Humera Automobile appear here with their specification, price and location."
          }
        />

        <div className="mt-10">
          {count > 0 ? (
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {vehicles.map((vehicle) => (
                <li key={vehicle.id} className="flex">
                  <VehicleCard vehicle={vehicle} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No vehicles are published on this site yet"
              description={
                <>
                  Humera Automobile&apos;s listings are not available online at
                  this time, so there is nothing to browse here. Vehicles can
                  still be sourced for you across the Dubai market - tell us the
                  make, model, year and budget you are working to and we will
                  tell you what is available and arrange a viewing.
                </>
              }
            />
          )}
        </div>
      </Container>
    </section>
  );
}
