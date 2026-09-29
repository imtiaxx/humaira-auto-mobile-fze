import Link from "next/link";

import { buttonClasses } from "@/components/ui/button-styles";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { EmptyState } from "@/components/ui/states";
import { ComparisonPicker } from "@/features/vehicles/components/comparison-picker";
import { MAX_COMPARISON, isComparable, withoutVehicle } from "@/features/vehicles/lib/compare";
import {
  formatMileage,
  formatVehiclePrice,
  vehiclePath,
  vehicleTitle,
  vehicleTitleWithYear,
} from "@/features/vehicles/lib/format";
import { VEHICLE_STATUS_LABELS } from "@/features/vehicles/lib/inventory";
import type { Vehicle } from "@/types/vehicle";

/**
 * The specification rows, in the order a buyer reads them.
 *
 * ---------------------------------------------------------------------------
 * Why these live here and not in `lib/compare.ts`
 * ---------------------------------------------------------------------------
 * Because they need the shared formatters, and every unit-tested module in
 * `features/vehicles/lib/` has exactly zero value imports - `node --test` cannot
 * resolve the `@/` alias, and `filters.ts` documents the workaround it needed for
 * the same reason. `compare.ts` therefore holds the logic worth testing, which is
 * reading and refusing untrusted input; the rows are presentation and sit beside
 * their only consumer.
 *
 * The trade is that these cells are checked by the rendered page rather than by a
 * unit test, which is the weaker guarantee. It is accepted because the
 * alternatives are worse: duplicating `formatVehiclePrice` here would let a
 * comparison disagree with the inventory about a price - on the one page a buyer
 * is invited to check two cars against each other - and a test-only indirection
 * would exist solely to satisfy the test runner.
 *
 * ---------------------------------------------------------------------------
 * A row is a label and a reader, and `null` means "not stated"
 * ---------------------------------------------------------------------------
 * So the decision about an absent value is made once, here, rather than in every
 * cell. `null` renders as an em dash: visibly an absence rather than a value.
 * Inventing a zero, a dash that looks like a figure, or a guess is the failure
 * this repository refuses - `mileage` is `null` because nobody recorded it, and
 * `0` would claim a used car has done no kilometres.
 *
 * `Price` and `Mileage` go through the existing formatters so a figure is
 * rendered here exactly as on a card and a detail page. `Status` uses the shared
 * label map, whose own documentation exists so a vehicle cannot be called "Sold"
 * on the card and "sold" here; `in_transit` is not something to show a customer.
 */
interface ComparisonRow {
  readonly label: string;
  /** A recorded value, or `null` when the field is not stated for this vehicle. */
  readonly value: (vehicle: Vehicle) => string | null;
  /** True for figures, which read down a column and take tabular numerals. */
  readonly numeric: boolean;
}

const COMPARISON_ROWS: readonly ComparisonRow[] = [
  { label: "Price", value: (v) => formatVehiclePrice(v), numeric: true },
  { label: "Year", value: (v) => String(v.year), numeric: true },
  { label: "Body type", value: (v) => v.bodyType, numeric: false },
  { label: "Fuel", value: (v) => v.fuel, numeric: false },
  { label: "Transmission", value: (v) => v.transmission, numeric: false },
  { label: "Mileage", value: (v) => (v.mileage === null ? null : formatMileage(v.mileage)), numeric: true },
  { label: "Colour", value: (v) => v.colour, numeric: false },
  { label: "Status", value: (v) => VEHICLE_STATUS_LABELS[v.status], numeric: false },
];

/** What a not-recorded value renders as. */
const NOT_RECORDED = "—";

/**
 * The comparison table.
 *
 * ---------------------------------------------------------------------------
 * Why a real `<table>`
 * ---------------------------------------------------------------------------
 * A comparison *is* tabular data: a fixed set of attributes down the side, one
 * column per vehicle across. `<table>` with `<th scope>` is what lets a screen
 * reader answer "what is the mileage of the second car", which is the only
 * question this page exists to answer. Two CSS grids and `aria-label`s would look
 * identical and be unreadable to assistive technology - and there was no table
 * anywhere in the codebase to copy, so this is the first.
 *
 * `scope="row"` on the label and `scope="col"` on each vehicle is not decoration:
 * it is what ties a value to its attribute and to its car. Without it a screen
 * reader announces a column of bare numbers.
 *
 * ---------------------------------------------------------------------------
 * The narrow-screen problem, and the honest answer to it
 * ---------------------------------------------------------------------------
 * Four columns of specifications do not fit on a phone. The options are a
 * horizontal scroll, per-attribute stacking, or a smaller cap, and this picks the
 * scroll - wrapped in a focusable, labelled region, because a scroll container a
 * keyboard user cannot reach is content they simply cannot see.
 *
 * The nicer alternative, stacking each attribute per vehicle on narrow screens,
 * is deliberately *not* done, because it renders different relationships than the
 * desktop view: comparing two cars' mileage across a vertical stack of separate
 * blocks is measurably harder than comparing two adjacent columns. One layout
 * that is merely tight beats two layouts that disagree about what sits next to
 * what.
 */
export function VehicleComparison({
  vehicles,
  catalogue,
  unmatched,
  overflow,
  malformedCount,
}: {
  /** Matched vehicles in the order requested. Zero, one, or two or more. */
  vehicles: readonly Vehicle[];
  /**
   * Every published vehicle, for the picker.
   *
   * Passed in rather than fetched so the table and the picker read the *same*
   * read. Two requests could disagree if a vehicle were published between them,
   * and a table comparing a car the picker does not offer is a visibly broken
   * page.
   */
  catalogue: readonly Vehicle[];
  /** Valid slugs that matched no published vehicle. */
  unmatched: readonly string[];
  /** Real vehicles the visitor asked for that the table had no room for. */
  overflow: number;
  /** Query values refused as malformed, for the report line. */
  malformedCount: number;
}) {
  const comparable = isComparable(vehicles.length);
  const selected = vehicles.map((vehicle) => vehicle.slug);

  return (
    <div className="bg-page">
      <section aria-labelledby="compare-heading" className="relative overflow-hidden border-b border-line">
        {/* The same header composition as /inventory and /brands, from the token layer. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_60%_60%_at_30%_0%,var(--surface-raised),transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_45%_55%_at_88%_8%,var(--color-accent-700),transparent)] opacity-25"
        />
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-action-accent" />

        <Container className="py-14 sm:py-16 lg:py-20">
          <div className="flex max-w-3xl flex-col gap-4">
            <p className="flex items-center gap-3 text-label text-fg-accent uppercase">
              <span aria-hidden="true" className="h-px w-8 bg-action-accent" />
              Side by side
            </p>

            {/* The page's only `h1`. Nothing below it may introduce another. */}
            <h1 id="compare-heading" className="text-display text-fg text-balance">
              Compare vehicles
            </h1>

            <p className="text-body-lg text-fg-secondary text-pretty">
              Put up to {MAX_COMPARISON} vehicles from our published stock next to each
              other, specification against specification. Every figure comes from the
              vehicle&apos;s own record, and anything not recorded is shown as a dash
              rather than guessed.
            </p>
          </div>
        </Container>
      </section>

      <section aria-labelledby="compare-table-heading" className="bg-page">
        <Container className="py-14 sm:py-16 lg:py-20">
          <SectionHeading
            titleId="compare-table-heading"
            title={
              comparable
                ? `${vehicles.length} ${vehicles.length === 1 ? "vehicle" : "vehicles"} compared`
                : "No comparison yet"
            }
          />

          {comparable ? (
            <>
              <ComparisonNotes unmatched={unmatched} overflow={overflow} malformedCount={malformedCount} />

              {/*
                `tabIndex={0}` makes the scroll container reachable by keyboard and
                `role="region"` with a label is what tells a screen reader that
                scrolling it is possible at all. Without both, a keyboard user meets
                columns they cannot scroll to and no way to learn that more exist.
              */}
              <div
                role="region"
                aria-labelledby="compare-table-heading"
                tabIndex={0}
                className="mt-8 overflow-x-auto focus-visible:ring-2 focus-visible:ring-(--ring-focus)"
              >
                <table className="w-full min-w-[42rem] border-collapse text-left">
                  <caption className="sr-only">
                    Specifications for the {vehicles.length} selected vehicles, side by side.
                  </caption>

                  <thead>
                    <tr>
                      <th scope="col" className="w-40 border-b border-line pb-4 pr-4 align-bottom">
                        <span className="text-label text-fg-muted uppercase">Specification</span>
                      </th>
                      {vehicles.map((vehicle) => (
                        <th key={vehicle.slug} scope="col" className="border-b border-line px-4 pb-4 align-bottom">
                          <span className="block text-h4 text-fg text-balance">
                            {vehicleTitle(vehicle)}
                          </span>
                          <span className="mt-1 block text-caption text-fg-muted">
                            {vehicle.year}
                            {vehicle.variant ? ` · ${vehicle.variant}` : ""}
                          </span>

                          {/*
                            Removal is a link, not a button with an onClick, so
                            removing a column is a navigation: the address bar always
                            holds the current comparison, Back undoes a removal, and
                            it works with JavaScript disabled. The accessible name
                            names the vehicle, because "Remove" in a row of four is
                            not a usable label on its own.
                          */}
                          <Link
                            href={withoutVehicle(selected, vehicle.slug)}
                            className="mt-3 inline-flex items-center text-caption text-fg-secondary underline underline-offset-4 hover:text-fg"
                          >
                            Remove
                            <span className="sr-only"> {vehicleTitleWithYear(vehicle)}</span>
                          </Link>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {COMPARISON_ROWS.map((row) => (
                      <tr key={row.label} className="rule-top">
                        <th
                          scope="row"
                          className="py-4 pr-4 align-top text-body-sm font-medium text-fg-secondary"
                        >
                          {row.label}
                        </th>
                        {vehicles.map((vehicle) => (
                          <td key={vehicle.slug} className="px-4 py-4 align-top text-body-sm text-fg">
                            {/*
                              `tnum` only on the numeric rows: figures are what read
                              down a column being compared against each other, which
                              is the case the design system reserves it for. A body
                              type in tabular figures would imply a precision it does
                              not have.
                            */}
                            <span className={row.numeric ? "tnum" : undefined}>
                              {row.value(vehicle) ?? NOT_RECORDED}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}

                    {/*
                      The action this page exists to enable, once per column rather
                      than once for the table: each vehicle has its own enquiry path,
                      and one button for four cars would not say which it was about.
                      It points at the real detail page, so the enquiry happens where
                      the rest of that vehicle's information is.
                    */}
                    <tr className="rule-top">
                      <th
                        scope="row"
                        className="py-5 pr-4 align-top text-body-sm font-medium text-fg-secondary"
                      >
                        Enquire
                      </th>
                      {vehicles.map((vehicle) => (
                        <td key={vehicle.slug} className="px-4 py-5 align-top">
                          <Link href={vehiclePath(vehicle.slug)} className={buttonClasses("secondary", "sm")}>
                            About this car
                            <span className="sr-only"> — {vehicleTitleWithYear(vehicle)}</span>
                          </Link>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="mt-8">
              <EmptyState
                title={
                  vehicles.length === 1
                    ? "Pick one more vehicle to compare"
                    : "Choose at least two vehicles"
                }
                description={
                  vehicles.length === 1
                    ? "A comparison needs two vehicles side by side. Tick another vehicle below and the table will open."
                    : `Tick at least two vehicles from the ${catalogue.length} currently published and the table will open here.`
                }
              />
            </div>
          )}
        </Container>
      </section>

      {/*
        The picker is its own band, sibling to the table rather than a block
        inside it - it is a `bg-sunken` control set in the shape
        `inventory-filters.tsx` established, and it renders its own `h2` and its
        own `section`, which is what keeps the heading outline
        (h1 -> h2 -> h2) and the landmark structure correct.
      */}
      <ComparisonPicker catalogue={catalogue} selected={selected} />
    </div>
  );
}

/**
 * The honest notes under the table.
 *
 * Each is a statement about what the visitor asked for that could not be
 * delivered, and each is reported rather than swallowed. A shared link with an
 * archived car, a selection of six, a hand-edited address with a typo: in all
 * three the alternative is a page that looks complete and is not, and the table
 * is the one place a visitor is most likely to trust exactly what they read.
 */
function ComparisonNotes({
  unmatched,
  overflow,
  malformedCount,
}: {
  unmatched: readonly string[];
  overflow: number;
  malformedCount: number;
}) {
  const notes: string[] = [];

  if (unmatched.length > 0) {
    const subject = unmatched.length === 1 ? "vehicle is" : "vehicles are";
    notes.push(
      `${unmatched.length} ${subject} no longer available and ${unmatched.length === 1 ? "was" : "were"} left out: ${unmatched.join(", ")}`,
    );
  }
  if (overflow > 0) {
    const verb = overflow === 1 ? "is" : "are";
    notes.push(
      `${overflow} more ${overflow === 1 ? "vehicle" : "vehicles"} you asked for ${verb} not shown — ${MAX_COMPARISON} is the limit`,
    );
  }
  if (malformedCount > 0) {
    const verb = malformedCount === 1 ? "was" : "were";
    notes.push(
      `${malformedCount} ${malformedCount === 1 ? "entry" : "entries"} in the address ${verb} not a valid vehicle reference and ${verb} ignored`,
    );
  }

  if (notes.length === 0) return null;

  return (
    <ul className="mt-6 flex flex-col gap-2">
      {notes.map((note) => (
        <li key={note} className="flex items-start gap-2.5 text-body-sm text-fg-secondary">
          <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-fg-muted" />
          {note}
        </li>
      ))}
    </ul>
  );
}
