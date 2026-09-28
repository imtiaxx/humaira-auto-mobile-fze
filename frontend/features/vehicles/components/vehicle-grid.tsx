import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { ActionLink } from "@/components/ui/action-link";
import { EmptyState } from "@/components/ui/states";
import { VehicleCard } from "@/features/vehicles/components/vehicle-card";
import { describeFilters } from "@/features/vehicles/lib/filters";
import type { Vehicle, VehicleFilters } from "@/types/vehicle";

/**
 * The results area: the vehicle grid, or an honest account of it being empty.
 *
 * ---------------------------------------------------------------------------
 * Three branches, because "no stock" and "no matches" are different facts
 * ---------------------------------------------------------------------------
 * The grid is what a visitor sees now that stock is published, and the empty
 * state remains a real branch: every vehicle can be archived, and a catalogue
 * whose last listing has been archived must still have something true to say.
 * It is written as a first-class state rather than a placeholder for one,
 * because the business trades whether or not anything is listed online.
 *
 * A filtered view adds a third, and it is the one that is easy to get wrong. A
 * visitor who searches for a diesel under $40,000 and sees "No vehicles are
 * published on this site yet" has been told the dealership is closed. It is not:
 * there are thirteen vehicles published, and none of them match. That is a
 * materially different statement, and for a business the wrong one costs an
 * enquiry. So the filtered-empty branch says what actually happened, and offers
 * the two things that can still help - widen the search, or ask us to source one.
 *
 * The wording in the unfiltered branch is chosen carefully, because most empty
 * states get this wrong in one of two directions:
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
 * its own documentation names both an empty inventory grid and "a filter that
 * matched nothing" as the cases it was written for. Reusing it means this page
 * cannot grow a second, subtly different treatment for the same situation; only
 * the words and the action differ.
 *
 * No `action` is passed to `EmptyState`. It renders its action as a `<button>`,
 * and this is a Server Component - an `onClick` here would ship JavaScript to do
 * nothing, and the one action worth offering is a *navigation*, which has to be a
 * link. `ActionLink` is a Server Component that renders a real `<a>`, so
 * middle-click, "open in new tab" and the keyboard all behave correctly.
 *
 * ---------------------------------------------------------------------------
 * Why the no-match branch names the filters
 * ---------------------------------------------------------------------------
 * "Nothing matches every filter at once" is true and close to useless on its
 * own. A visitor who asked for a Toyota, a diesel, and under $90,000 has four
 * ways to be wrong and no way to tell which, so the state tells them: the
 * applied filters are written back as `Toyota, Diesel, from $90,000`, which is the
 * difference between knowing the search was too narrow and guessing at it.
 *
 * The summary is the *parsed* filter, not the raw query string, so a value the
 * parser rejected does not appear in a sentence about why nothing matched. That
 * value is reported beside its own field, in the form above, where the visitor
 * can edit it - a rejected value is a form problem, not a reason for an empty
 * grid, and mixing the two would blame the wrong thing.
 */
export function VehicleGrid({
  vehicles,
  headingId = "listings-heading",
  filtered = false,
  filters = {},
}: {
  vehicles: Vehicle[];
  /**
   * Wired to the heading so the region is named by its own visible title, and
   * passed through to `SectionHeading` so the referenced element actually
   * exists - an `aria-labelledby` pointing at nothing leaves the section with
   * no accessible name at all.
   */
  headingId?: string;
  /**
   * Whether the results arrived through a filter. Changes only the wording of the
   * zero-result branch and nothing else, so it defaults to `false` and every
   * existing call site is unaffected.
   */
  filtered?: boolean;
  /**
   * The filter that produced these results, used only to describe the no-match
   * branch. Defaults to empty so an unfiltered call site passes neither flag nor
   * filter and the summary is simply not rendered.
   */
  filters?: VehicleFilters;
}) {
  const count = vehicles.length;
  const summary = describeFilters(filters);

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
          ) : filtered ? (
            /*
              The link is outside `EmptyState` because its `action` prop renders a
              `<button>`, and this action navigates rather than mutates anything.
            */
            <div className="flex flex-col items-center gap-5">
              <EmptyState
                title="No vehicles match this search"
                description={
                  <>
                    {summary ? (
                      <>
                        Nothing in the inventory matches{" "}
                        <span className="text-fg">{summary}</span> at once. Filters
                        combine, so widening one - the price, the year, or the fuel
                        type - usually brings results back. If you are looking for
                        something we do not have listed, we source across the Dubai
                        market and will tell you what is available.
                      </>
                    ) : (
                      <>
                        Nothing in the inventory matches every filter at once.
                        Filters combine, so widening one - the price, the year, or
                        the fuel type - usually brings results back. If you are
                        looking for something we do not have listed, we source
                        across the Dubai market and will tell you what is
                        available.
                      </>
                    )}
                  </>
                }
              />
              <ActionLink href="/inventory" variant="outline">
                Clear all filters
              </ActionLink>
            </div>
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
