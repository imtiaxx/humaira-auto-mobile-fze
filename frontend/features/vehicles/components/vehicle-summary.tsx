import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Divider } from "@/components/ui/divider";
import { VEHICLE_STATUS_LABELS } from "@/features/vehicles/lib/inventory";
import { formatMileage, formatVehiclePrice, vehicleTitle } from "@/features/vehicles/lib/format";
import type { Vehicle } from "@/types/vehicle";

/**
 * Who this vehicle is, what it costs and what it is.
 *
 * ---------------------------------------------------------------------------
 * Availability is stated here, unlike on the card
 * ---------------------------------------------------------------------------
 * Step 7 badges only the exception states, because a grid of tiles that all say
 * "Available" is a column of the same word and the badge would push the make and
 * model - the reason the tile exists - down the card.
 *
 * A detail page is the opposite case. There is exactly one vehicle, a visitor has
 * chosen to look at it, and "is this one still available?" is the first question
 * the page has to answer. So all three states are badged here, and the badge tone
 * is the same mapping the card uses, so a reserved car cannot look available on
 * one page and reserved on the other.
 *
 * The tone is never the only signal. Every badge carries its label as text, and
 * `VEHICLE_STATUS_LABELS` supplies the word, so the state is legible without
 * colour.
 *
 * ---------------------------------------------------------------------------
 * The price comes from the shared formatter
 * ---------------------------------------------------------------------------
 * `formatVehiclePrice` is the same function the card uses, so a figure can never
 * be rendered one way in the grid and another way here. That is also what keeps
 * the currency honest: there is exactly one place in the codebase that turns a
 * `number | null` into a price string, and it only ever produces USD.
 *
 * ---------------------------------------------------------------------------
 * Specifications that are absent are not shown
 * ---------------------------------------------------------------------------
 * The key-spec row is assembled by filtering out the values the data does not
 * have, exactly as the card does. A car recorded without a transmission or a
 * colour produces a shorter row, not a longer one padded with dashes. `year` is
 * the only guaranteed figure, because the model requires it.
 *
 * `tnum` because these are numbers a buyer compares against other vehicles -
 * the case the design system reserves tabular numerals for.
 */
const STATUS_TONES: Record<Vehicle["status"], BadgeTone> = {
  available: "success",
  reserved: "warning",
  sold: "neutral",
};

export function VehicleSummary({ vehicle }: { vehicle: Vehicle }) {
  const specs = [
    String(vehicle.year),
    vehicle.transmission,
    vehicle.fuel,
    vehicle.bodyType,
    vehicle.mileage === null ? null : formatMileage(vehicle.mileage),
  ].filter((value): value is string => value !== null);

  return (
    <div className="flex flex-col gap-6">
      {/*
        `text-balance` is load-bearing on this heading. Vehicle names are long and
        unpredictable, and an unbalanced three-line make/model/variant stack is
        the most likely cause of a ragged title on a 320px screen.
      */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/*
            The status sits above the name as a label rather than beside it, so a
            long name cannot push it off the end of the row on a narrow screen.
            `flex-wrap` handles the combination of a long badge and a long name.
          */}
          <Badge tone={STATUS_TONES[vehicle.status]} dot>
            {VEHICLE_STATUS_LABELS[vehicle.status]}
          </Badge>

          {vehicle.location ? (
            <span className="text-caption text-fg-muted">{vehicle.location}</span>
          ) : null}
        </div>

        {/* The page's only `h1`. */}
        <h1 className="text-h1 text-fg text-balance">{vehicleTitle(vehicle)}</h1>

        {vehicle.variant ? (
          <p className="text-body-lg text-fg-secondary text-pretty">{vehicle.variant}</p>
        ) : null}
      </div>

      <Divider />

      {/*
        The price. The largest figure on the page after the title, in
        `text-fg` at display weight, because a buyer scans for it.

        `Price on request` renders at a smaller size than a real figure would
        need: it is a phrase, not a number, and setting a six-word sentence in the
        display size is how pages end up with a price slot that shouts "nothing
        here". The condition is on the *value*, not the status, so a genuinely
        unpriced car and a sold car can never be confused for one another.
      */}
      <p className="text-h2 text-fg text-balance">
        {formatVehiclePrice(vehicle)}
      </p>

      {/*
        Key specifications. The real characters between the values keep this
        readable if a stylesheet fails to load, which is why the separator is a
        "·" and not a border or a background.
      */}
      <p className="tnum text-body-sm text-fg-secondary">{specs.join("  ·  ")}</p>
    </div>
  );
}
