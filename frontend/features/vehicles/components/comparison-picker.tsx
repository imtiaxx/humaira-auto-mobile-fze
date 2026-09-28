import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { COMPARISON_KEY, MAX_COMPARISON, MIN_COMPARISON } from "@/features/vehicles/lib/compare";
import { formatVehiclePrice, vehicleTitleWithYear } from "@/features/vehicles/lib/format";
import type { Vehicle } from "@/types/vehicle";

/**
 * The vehicle picker.
 *
 * ---------------------------------------------------------------------------
 * A plain GET form, and why there is no client state
 * ---------------------------------------------------------------------------
 * `<form method="get" action="/compare">` with one checkbox per published
 * vehicle, all named `vehicles`. There is no `useState`, no `onChange`, no
 * `useRouter` and nothing to hydrate. That is the same decision
 * `inventory-filters.tsx` makes and it buys the same four things:
 *
 *   1. **It works without JavaScript.** The checkboxes are native inputs; the
 *      `Checkbox` component is a `"use client"` island for its focus ring and
 *      44px target, but submitting the form depends on none of that.
 *   2. **The URL is the state.** A comparison is a shareable address, which is
 *      the whole reason a comparison page is worth having over a dialog: a
 *      dealer can send a customer "these two, at this link" and it still works
 *      in a month.
 *   3. **Back and forward work**, with no history entries to fake.
 *   4. **Repeated `name` values are the documented shape.** One
 *      `?vehicles=a&vehicles=b`, which is what `parseComparison` reads and what
 *      `comparePath` writes, so the form and the parser cannot drift.
 *
 * ---------------------------------------------------------------------------
 * Why the four-vehicle cap is *not* enforced by disabling boxes
 * ---------------------------------------------------------------------------
 * The obvious client-side approach is to disable the unchecked boxes once four
 * are ticked. It is not done, because a disabled checkbox is not submitted: a
 * visitor who ticks six vehicles and submits would have four silently dropped,
 * with the control they had just used greyed out and unresponsive, and no way to
 * find out which two went missing.
 *
 * Silently discarding a choice is the specific failure this repository refuses
 * elsewhere - a sold car is labelled "Sold" rather than quietly filtered out. So
 * the cap is enforced in `parseComparison`, which keeps the first four, counts
 * the rest, and the page reports "2 more vehicles you asked for are not shown -
 * 4 is the limit". A visible, explained cap is a better answer than a control
 * that stops responding.
 *
 * The same reasoning is why there is no `required` and no native validation
 * bubble. The minimum is a cross-field rule across a variable number of
 * checkboxes, which no attribute can express, and a browser bubble that
 * disagreed with the page's own message about the same problem would be worse
 * than one consistent answer.
 *
 * ---------------------------------------------------------------------------
 * Why the list is not the inventory grid
 * ---------------------------------------------------------------------------
 * A comparison is about *choosing between* specific vehicles, and the useful
 * metadata here is the identity of each car and its price. The grid's cards
 * carry imagery, a body type and a mileage chip, which at four-across would push
 * the actual controls below the fold and make ticking five boxes a scroll. This
 * is a control set, and `inventory-filters.tsx` already established that a
 * control set on this site is a plain form in a `bg-sunken` band.
 */
export function ComparisonPicker({
  catalogue,
  selected,
}: {
  /** Every published vehicle. */
  catalogue: readonly Vehicle[];
  /** Slugs currently in the comparison, so their boxes start ticked. */
  selected: readonly string[];
}) {
  const chosen = new Set(selected.map((slug) => slug.toLowerCase()));
  const hasSelection = chosen.size > 0;
  const needsMore = hasSelection && chosen.size < MIN_COMPARISON;

  return (
    <section aria-labelledby="compare-picker-heading" className="border-b border-line bg-sunken">
      <Container className="py-16 sm:py-20">
        <SectionHeading
          titleId="compare-picker-heading"
          eyebrow="Choose"
          title="Pick the vehicles to compare"
          description={`Tick between ${MIN_COMPARISON} and ${MAX_COMPARISON} vehicles. The list shows every published vehicle, and the table above updates to match your selection.`}
        />

        {/*
          The fieldset is the grouping. `Checkbox` renders its own `<label>`, so
          the legend is the only thing naming the group as a whole - which is what
          a screen reader needs to announce before a list of thirteen checkboxes
          with no indication of what they are for.
        */}
        <form method="get" action="/compare" className="mt-10 flex flex-col gap-6">
          <fieldset className="border-0 p-0">
            <legend className="sr-only">
              Published vehicles available to add to the comparison
            </legend>

            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {catalogue.map((vehicle) => {
                const isChosen = chosen.has(vehicle.slug.toLowerCase());

                return (
                  /*
                    `defaultChecked`, not `checked`. The form is uncontrolled and
                    is re-rendered from the submitted URL by the server, so the
                    browser's own state after submission is replaced by whatever
                    the address says. A controlled `checked` with no `onChange`
                    would be a read-only input that cannot be unticked.
                  */
                  <Checkbox
                    key={vehicle.slug}
                    name={COMPARISON_KEY}
                    value={vehicle.slug}
                    defaultChecked={isChosen}
                    label={vehicleTitleWithYear(vehicle)}
                    /*
                      The price is the second line rather than part of the label,
                      because it is context for the choice and not part of the
                      vehicle's identity. It goes through the shared formatter, so
                      this cannot read "$0" for a sold car the way a raw number
                      would.
                    */
                    description={formatVehiclePrice(vehicle)}
                  />
                );
              })}
            </div>
          </fieldset>

          {/*
            The actions sit outside the fieldset so a long list cannot leave the
            submit button off the bottom of a screen, and so the state line and
            the button are read together.
          */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/*
              `type="submit"` explicitly. `Button` defaults to `type="button"`,
              which is right for a client island firing an `onClick` and wrong
              here: a click that did not submit would be a dead control.
            */}
            <Button type="submit" variant="primary">
              Compare selected
            </Button>

            {/*
              Shown whenever a selection is in the address, not only when a table
              is showing. Clearing is the way back from a comparison that found
              nothing, and it has to be reachable from the form that built it.
            */}
            {hasSelection ? (
              <Link
                href="/compare"
                className="text-body-sm text-fg-secondary underline underline-offset-4 hover:text-fg"
              >
                Clear selection
              </Link>
            ) : null}

            <p className="text-body-sm text-fg-muted">
              {hasSelection
                ? `${chosen.size} of ${MAX_COMPARISON} selected`
                : `${catalogue.length} published ${catalogue.length === 1 ? "vehicle" : "vehicles"}`}
            </p>
          </div>

          {/*
            Shown *before* submission, when the visitor has clearly started but
            cannot yet make a comparison. Telling them here rather than only on
            the reloaded page means they are not left wondering why the button did
            nothing visible.
          */}
          {needsMore ? (
            <p className="text-body-sm text-fg-secondary">
              {chosen.size === 1
                ? "Tick one more vehicle to make a comparison."
                : `Tick at least ${MIN_COMPARISON} vehicles to make a comparison.`}
            </p>
          ) : null}
        </form>
      </Container>
    </section>
  );
}
