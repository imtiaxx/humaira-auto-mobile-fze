import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatMileage, vehicleTitle } from "@/features/vehicles/lib/format";
import type { Vehicle } from "@/types/vehicle";

/**
 * Everything the data actually records about this vehicle.
 *
 * ---------------------------------------------------------------------------
 * The section decides whether it exists
 * ---------------------------------------------------------------------------
 * A specification table is the easiest place on a site to ship a page full of
 * dashes. This component assembles its rows first and returns `null` when there
 * are none, so a car recorded with only a make, model and year does not get an
 * "Other details" heading above three empty rows.
 *
 * That is a real case, not a hypothetical: `types/vehicle.ts` makes variant,
 * transmission, fuel, body type, colour, mileage, VIN, location and the whole
 * `features` set all optional, because all of them genuinely are optional on real
 * stock. Rendering the heading anyway would promise detail the data does not
 * have.
 *
 * ---------------------------------------------------------------------------
 * Rows are built as pairs, then filtered
 * ---------------------------------------------------------------------------
 * Every row is a `[label, value]` pair where the value may be absent. A single
 * filter drops the absent ones. This is why the table can never show "Mileage:
 * --" or "0 km": a value has to exist before it becomes a row, and `mileage: 0`
 * is not something the formatter invents - `null` is the only way to say "not
 * recorded", so "not recorded" is the only way a row disappears.
 *
 * `features` is spread in after the known fields. It is the free-form
 * key/value set from the planned `VehicleFeature` table, so it is genuinely
 * unknown in advance - which is exactly why the section is built by collecting
 * rows rather than by writing a fixed list of `<dt>`s.
 *
 * ---------------------------------------------------------------------------
 * A definition list, because it is one
 * ---------------------------------------------------------------------------
 * `<dl>` with `<dt>`/`<dd>` is the correct structure for a set of term/value
 * pairs, and it lets a screen reader announce "VIN, JTDK..." as a pair rather
 * than as an anonymous string of text. The two-column grid is a layout concern
 * only; the semantics survive it.
 *
 * `break-words` on the values is a real requirement, not decoration: a VIN is 17
 * unbroken alphanumeric characters and is the single longest token on the page.
 * Without it, a VIN is the thing that produces a horizontal scrollbar at 320px.
 *
 * The value column is a fixed proportion on wide viewports so the labels line up
 * as a column and the table reads as a table, and it collapses to a single column
 * on a phone where two columns would leave each value about 120px wide.
 */
export function VehicleDetails({ vehicle }: { vehicle: Vehicle }) {
  const rows: ReadonlyArray<readonly [string, string]> = [
    ["Make", vehicle.make],
    ["Model", vehicle.model],
    ["Variant", vehicle.variant],
    ["Year", String(vehicle.year)],
    ["Body type", vehicle.bodyType],
    ["Transmission", vehicle.transmission],
    ["Fuel", vehicle.fuel],
    ["Colour", vehicle.colour],
    ["Mileage", vehicle.mileage === null ? null : formatMileage(vehicle.mileage)],
    ["VIN", vehicle.vin],
    ["Location", vehicle.location],
    ...Object.entries(vehicle.features).map(
      ([label, value]) => [label, value] as const,
    ),
  ].filter((row): row is readonly [string, string] => Boolean(row[1]));

  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="vehicle-details-heading" className="bg-page">
      <Container className="py-16 sm:py-20">
        <SectionHeading
          titleId="vehicle-details-heading"
          eyebrow="Specification"
          title="Vehicle details"
          description={`Everything recorded about this ${vehicleTitle(vehicle)}. Anything not listed has not been recorded.`}
        />

        <dl className="mt-10 grid grid-cols-1 gap-x-10 gap-y-0 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
          {rows.map(([label, value], index) => (
            <div
              key={label}
              className={[
                "flex min-w-0 flex-col gap-1 py-4 sm:flex-row sm:items-baseline sm:gap-6",
                // Hairline separators instead of borders on every cell, so the
                // first row has no line above it and the last has none below.
                index > 0 ? "border-t border-line" : "",
              ].join(" ")}
            >
              <dt className="shrink-0 text-caption text-fg-muted uppercase sm:pt-1">
                {label}
              </dt>
              <dd className="min-w-0 break-words text-body text-fg">{value}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  );
}
