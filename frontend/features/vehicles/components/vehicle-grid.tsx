import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { EmptyState } from "@/components/ui/states";
import { VehicleCard } from "@/features/vehicles/components/vehicle-card";
import type { Vehicle } from "@/types/vehicle";

/**
 * The results area: the vehicle grid, or an honest account of it being empty.
 *
 * ---------------------------------------------------------------------------
 * Both branches are the product right now
 * ---------------------------------------------------------------------------
 * `listVehicles()` returns an empty array today, so the empty state is what a
 * visitor sees. It is written as a first-class state of this page rather than as
 * a placeholder for one, because that is the truthful description of the
 * business: a confirmed showroom and a confirmed trade, with no stock published
 * to the web.
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
  return (
    <section aria-labelledby={headingId} className="bg-page">
      <Container className="py-16 sm:py-20">
        <SectionHeading
          titleId={headingId}
          eyebrow="Listings"
          title="Vehicles available now"
          description="Vehicles published by Humera Automobile appear here with their specification, price and location."
        />

        <div className="mt-10">
          {vehicles.length > 0 ? (
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
