import Link from "next/link";

import { Container } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { SectionHeading } from "@/components/ui/section-heading";
import { Select } from "@/components/ui/select";
import {
  FILTER_STATUSES,
  type VehicleFilterErrors,
} from "@/features/vehicles/lib/filters";
import { VEHICLE_STATUS_LABELS } from "@/features/vehicles/lib/inventory";
import type { FacetOption, VehicleFacets } from "@/features/vehicles/lib/facets";

/**
 * The inventory filter control set.
 *
 * ---------------------------------------------------------------------------
 * This component replaces `sourcing-criteria.tsx`, and says so
 * ---------------------------------------------------------------------------
 * The file it replaces is where the idea was first written down. Its own
 * documentation said: "With no published inventory, a set of filters has nothing
 * to filter… **When inventory is published, this becomes a real control set** and
 * the `VehicleFilters` interface in `types/vehicle.ts` is already the shape it
 * will take."
 *
 * There are now thirteen published vehicles, so the condition its author named
 * has arrived and the band is no longer a static description of a service. It
 * keeps the same place in the page, the same `bg-sunken` band, the same `h2` and
 * the same eyebrow, so the layout the design was approved with does not move.
 * What changed is that the four criteria - make, model, year, budget - are now
 * controls that do the thing the section used to ask a visitor to do by email.
 * The sourcing service itself did not disappear: it is the conversion panel below
 * the grid, which is where a visitor goes when a filter finds nothing.
 *
 * ---------------------------------------------------------------------------
 * A plain GET form, and why there is no client router
 * ---------------------------------------------------------------------------
 * `<form method="get" action="/inventory">` submits to the server and the page
 * re-renders. There is no `onSubmit`, no `useRouter`, no client-side fetch and
 * no "apply" button in a disabled-until-valid state.
 *
 * That is a deliberate choice with four consequences, all of them wanted:
 *
 *   1. **It works without JavaScript.** The form is native HTML, so nothing here
 *      depends on hydration. A customer on a slow connection or a script-blocked
 *      browser can still filter stock.
 *   2. **The URL is the state.** A filtered inventory is a shareable, bookmarkable
 *      address, which is what a search page is expected to have and what lets a
 *      dealer send a customer "the two we have in that body type are at this
 *      link" and have it still work in a month.
 *   3. **Back and forward work**, with no history entries to fake.
 *   4. **The query string is the documented API query string.** The control `name`
 *      attributes are `body_type`, `min_price` and friends, not camelCase, so the
 *      address bar holds the same vocabulary `docs/api.md` documents.
 *
 * `Field`, `Input`, `SearchInput` and `Select` are `"use client"` components
 * (`useId`, for label association), so this band is a client island. That costs a
 * little JavaScript on one page and buys the design system's label wiring, focus
 * rings and invalid states rather than four re-derived copies of them - the trade
 * `features/staff/components/vehicle-form.tsx` already makes.
 *
 * ---------------------------------------------------------------------------
 * Validation is the parser's job, not the browser's
 * ---------------------------------------------------------------------------
 * The number inputs carry **no `min` and no `max`**, and `step="any"`.
 *
 * The bounds are the part that matters. Without them, native constraint
 * validation fires on the out-of-range figure, blocks the submit, and shows a
 * browser-styled bubble on one field while every other field on this page
 * reports through the parser's own message, styled by the design system. Two
 * validation systems on one form means the visitor gets whichever one runs
 * first, and it would be the one that ignores the cross-field rules.
 *
 * `step` is the subtlety worth recording, because "no step attribute" is not the
 * same thing as "no step validation". `type="number"` implies `step=1`, so an
 * omitted step would silently reject `25000.50` with a native bubble - which the
 * backend's `Decimal` accepts. Declaring `step="any"` states that the shape of
 * the number is not this form's business; the two decimal places the backend
 * allows are then enforced once, in `filters.ts`.
 *
 * So `filters.ts` is the single validator, and it can say things no attribute
 * expresses - "Maximum price cannot be below the minimum" is a cross-field rule,
 * and neither `min` nor `max` can say it.
 */

/**
 * The field names, in the wire vocabulary. One place, so form and parser agree.
 *
 * `transmission` is deliberately absent: it is no longer offered as an inventory
 * filter, and a name that maps to no control is dead weight here.
 *
 * That is a change to this *form* only. The parameter is still accepted by
 * `filters.ts` and still honoured by the API, and transmission is still shown on
 * the vehicle detail page, in compare, and in the staff vehicle form. Removing a
 * filter is not the same as removing the attribute, and this dealership still
 * records one.
 */
const FIELDS = {
  query: "query",
  make: "make",
  bodyType: "body_type",
  fuel: "fuel",
  minPrice: "min_price",
  maxPrice: "max_price",
  minYear: "min_year",
  maxYear: "max_year",
  status: "status",
} as const;

function money(value: number | null): string {
  return value === null ? "" : value.toLocaleString("en-US");
}

/**
 * One facet dropdown.
 *
 * The first option is a real, selectable `Any` rather than the `Select`
 * component's `placeholder`, which is rendered `disabled`. A disabled first
 * option is the right pattern for a required field, where "unset" is a mistake -
 * but here "unset" is a legitimate and common choice, and a visitor who has
 * filtered by fuel and wants to switch to body type should be able to clear the
 * control by selecting "Any" rather than hunting for the reset elsewhere.
 *
 * ---------------------------------------------------------------------------
 * What the count in brackets means
 * ---------------------------------------------------------------------------
 * Each option carries the number of **published** vehicles with that value, taken
 * from the unfiltered inventory. So after `?fuel=Diesel` the make list can read
 * "Toyota (7)" beside a result line saying "Showing 4 of 13": the bracket is
 * what the dealership holds, not what the current search would return. It is not
 * a live count of the current selection, and pretending otherwise would need a
 * per-facet count for every combination of the others - ten extra requests on
 * every keystroke of a form, for a number nobody reads before deciding.
 *
 * It is here to answer the question a visitor actually has while looking at a
 * dropdown: *is choosing this going to narrow anything at all?* Without it,
 * "pick up" and "Electric" look equally promising.
 *
 * The count is text, the value is the raw spelling from the database. A
 * prettified value would be one the endpoint has never heard of, and the backend
 * matches case-insensitively, so normalising the label costs nothing and
 * breaking the value costs the match.
 */
function FacetSelect({
  name,
  label,
  help,
  options,
  selected,
  error,
}: {
  name: string;
  label: string;
  help: string;
  options: readonly FacetOption[];
  selected: string;
  error?: string;
}) {
  return (
    <Field label={label} help={help} error={error}>
      <Select name={name} defaultValue={selected} invalid={Boolean(error)}>
        <option value="">Any</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.value} ({option.count})
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function InventoryFilters({
  facets,
  values,
  errors,
  resultCount,
  publishedCount,
  active,
}: {
  facets: VehicleFacets;
  /**
   * The submitted values, as strings, so a rejected control re-renders filled in
   * with what the visitor typed.
   *
   * Strings rather than the parsed filter, because the parsed filter has already
   * dropped the rejected values - rendering from it would blank the field that
   * produced the error message beside it.
   */
  values: Record<string, string | undefined>;
  errors: VehicleFilterErrors;
  resultCount: number;
  publishedCount: number;
  /** True when at least one filter survived parsing and is narrowing the API read. */
  active: boolean;
}) {
  return (
    <section aria-labelledby="filter-heading" className="border-b border-line bg-sunken">
      <Container className="py-16 sm:py-20">
        <SectionHeading
          titleId="filter-heading"
          eyebrow="Filter"
          title="Narrow the inventory"
          description="Search by make or model, or set the specification you are looking for. Every filter is optional, they combine, and a filter that matches nothing is a real answer rather than an error."
        />

        {/*
          `method="get"` with no `onSubmit`. A GET submission replaces the entire
          query string with the form's own fields, which is right here: the form
          carries all nine filters, so a filter the visitor has since cleared
          disappears from the URL instead of surviving invisibly.
        */}
        <form method="get" action="/inventory" className="mt-10 flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              label="Make or model"
              help="Part of a name, so &ldquo;land&rdquo; finds Land Cruiser and Land Rover."
              error={errors.query}
              className="sm:col-span-2 lg:col-span-4"
            >
              <SearchInput
                name={FIELDS.query}
                defaultValue={values[FIELDS.query]}
                placeholder="Any make or model"
                invalid={Boolean(errors.query)}
                maxLength={120}
              />
            </Field>

            <FacetSelect
              name={FIELDS.make}
              label="Make"
              help="Makes currently published."
              options={facets.makes}
              selected={values[FIELDS.make] ?? ""}
              error={errors.make}
            />

            <FacetSelect
              name={FIELDS.bodyType}
              label="Body type"
              help="As recorded on each vehicle."
              options={facets.bodyTypes}
              selected={values[FIELDS.bodyType] ?? ""}
              error={errors.body_type}
            />

            <FacetSelect
              name={FIELDS.fuel}
              label="Fuel"
              help="Vehicles with no fuel recorded are not included."
              options={facets.fuels}
              selected={values[FIELDS.fuel] ?? ""}
              error={errors.fuel}
            />

            <Field
              label="Minimum price (USD)"
              help="Vehicles with no published price are never included."
              error={errors.min_price}
            >
              <Input
                name={FIELDS.minPrice}
                type="number"
                inputMode="decimal"
                step="any"
                defaultValue={values[FIELDS.minPrice]}
                placeholder={money(facets.minPrice)}
                invalid={Boolean(errors.min_price)}
              />
            </Field>

            <Field
              label="Maximum price (USD)"
              help="Leave empty for no upper limit."
              error={errors.max_price}
            >
              <Input
                name={FIELDS.maxPrice}
                type="number"
                inputMode="decimal"
                step="any"
                defaultValue={values[FIELDS.maxPrice]}
                placeholder={money(facets.maxPrice)}
                invalid={Boolean(errors.max_price)}
              />
            </Field>

            <Field label="Earliest year" help="Inclusive." error={errors.min_year}>
              <Input
                name={FIELDS.minYear}
                type="number"
                inputMode="numeric"
                step="any"
                defaultValue={values[FIELDS.minYear]}
                placeholder={facets.minYear === null ? "" : String(facets.minYear)}
                invalid={Boolean(errors.min_year)}
              />
            </Field>

            <Field label="Latest year" help="Inclusive." error={errors.max_year}>
              <Input
                name={FIELDS.maxYear}
                type="number"
                inputMode="numeric"
                step="any"
                defaultValue={values[FIELDS.maxYear]}
                placeholder={facets.maxYear === null ? "" : String(facets.maxYear)}
                invalid={Boolean(errors.max_year)}
              />
            </Field>

            <Field
              label="Availability"
              help="Sold vehicles stay listed as sold."
              error={errors.status}
            >
              <Select
                name={FIELDS.status}
                defaultValue={values[FIELDS.status] ?? ""}
                invalid={Boolean(errors.status)}
              >
                <option value="">Any</option>
                {/*
                  `VEHICLE_STATUS_LABELS` rather than words written here, so a
                  vehicle cannot be called "Sold" in this dropdown and "SOLD" on
                  its card. That constant exists for exactly this reason.
                */}
                {FILTER_STATUSES.map((state) => (
                  <option key={state} value={state}>
                    {VEHICLE_STATUS_LABELS[state]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/*
            The actions sit outside the field grid so that a validation message on
            the last control cannot push the submit button out of the row and
            leave the visitor with no way to run the search.
          */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/*
              `type="submit"` explicitly. `Button` defaults to `type="button"`,
              which is correct for a client component firing an `onClick` and wrong
              here: a click that does not submit would be a dead control.
            */}
            <Button type="submit" variant="primary">
              Show vehicles
            </Button>

            {/*
              Shown whenever a filter is narrowing the read, **not** whenever the
              result count differs from the published count. A filter that happens
              to match everything - `?fuel=Diesel` on an all-diesel inventory - is
              still a filtered view, and a visitor in it still needs a way back.
              The count is the wrong signal; `active` is the right one.
            */}
            {active ? (
              <Link
                href="/inventory"
                className="text-body-sm text-fg-secondary underline underline-offset-4 hover:text-fg"
              >
                Clear all filters
              </Link>
            ) : null}

            <p className="text-body-sm text-fg-muted">
              {active
                ? `Showing ${resultCount} of ${publishedCount} published ${
                    publishedCount === 1 ? "vehicle" : "vehicles"
                  }`
                : `${publishedCount} published ${
                    publishedCount === 1 ? "vehicle" : "vehicles"
                  }`}
            </p>
          </div>
        </form>
      </Container>
    </section>
  );
}
