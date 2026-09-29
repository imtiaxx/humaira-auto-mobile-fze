import Image from "next/image";
import Link from "next/link";

import { WhatsAppCta } from "@/components/cta/whatsapp-cta";
import { ArrowUpRight, Car, MapPin } from "@/components/icons";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { VEHICLE_STATUS_LABELS } from "@/features/vehicles/lib/inventory";
import { formatMileage, formatVehiclePrice, vehiclePath, vehicleTitle } from "@/features/vehicles/lib/format";
import { cn } from "@/lib/cn";
import type { Vehicle } from "@/types/vehicle";

/**
 * A single vehicle listing tile.
 *
 * ---------------------------------------------------------------------------
 * Built for real inventory, which is mostly incomplete
 * ---------------------------------------------------------------------------
 * The `Vehicle` type allows a photo, a price, a mileage, a VIN, a trim and a
 * location all to be absent, because all of them genuinely are absent on real
 * stock. Every one of those cases is handled here explicitly:
 *
 *   - no image        -> a neutral placeholder, never a broken image icon
 *   - no price        -> "Price on request", never a rendered `0` or a dash
 *   - no mileage      -> the spec is dropped, not shown as "0 km"
 *   - no transmission -> dropped from the spec row rather than padded out
 *
 * The spec row is assembled by filtering the absent values out and joining what
 * is left, so a sparsely-recorded car produces a short row instead of a long
 * one with gaps in it. That is the difference between a tile that looks designed
 * and one that looks like a form that was filled in badly.
 *
 * ---------------------------------------------------------------------------
 * Status is shown only when it is not the default
 * ---------------------------------------------------------------------------
 * An inventory page is, by definition, mostly "Available" vehicles. A badge on
 * every tile that says the same word is noise that pushes the make and model -
 * the two things the tile exists to communicate - down the card. So "Available"
 * is implied by the page and only the exceptions (`Reserved`, `Sold`) earn a
 * badge. Tones follow the mapping documented in `components/ui/badge.tsx`.
 *
 * ---------------------------------------------------------------------------
 * The action is a link to the vehicle, plus the shared WhatsApp CTA
 * ---------------------------------------------------------------------------
 * Step 7 shipped this tile with no link at all, because `/inventory/[vehicleSlug]`
 * did not exist and a link to it would have been a 404 behind the most prominent
 * element on the tile. That route exists now, so the make and model is a link -
 * and it links through `vehiclePath`, the same helper the breadcrumb and the
 * canonical metadata use, so the tile, the page and the address bar agree.
 *
 * The WhatsApp CTA stays as a second, separate path, pre-filled with the
 * vehicle's own reference, which means the conversation starts with the car
 * already named. `WhatsAppCta` defaults to rendering nothing when no number is
 * configured, which is what a listing page needs: with twenty vehicles on
 * screen, twenty visibly dead buttons would be far worse than none. The number
 * lives in the environment, never in this file.
 *
 * ---------------------------------------------------------------------------
 * Prices
 * ---------------------------------------------------------------------------
 * Formatting moved to `features/vehicles/lib/format.ts` in Step 8 so the card and
 * the detail page cannot disagree about how a car is priced, and so there is
 * exactly one place in the codebase that turns a price into a customer-facing
 * string. `formatVehiclePrice` owns the "Sold" case too, so this file does not
 * branch on status.
 *
 * ---------------------------------------------------------------------------
 * Images
 * ---------------------------------------------------------------------------
 * `next/image` is used for real photography so the tile gets lazy loading, a
 * fixed intrinsic box and AVIF/WebP. The stock published today is served by the
 * API's own media route, so the same photograph is optimised twice on the way to
 * a tile: once by the backend on upload, once here for the size actually
 * requested. The placeholder branch above still carries the majority of the
 * contract - a vehicle can genuinely have no photo - so both paths stay.
 *
 * A short top-down scrim sits over the image. Photography is unpredictable, and
 * a badge or edge placed directly on it has to stay legible against a pale sky
 * shot and a dark night shot alike.
 *
 * ---------------------------------------------------------------------------
 * Colour
 * ---------------------------------------------------------------------------
 * The tile is already on the dark canvas - the inventory route's `bg-page`
 * wrapper - so `bg-raised`, `text-fg` and `border-line` resolve to the near-black
 * values without a scope. The only accent the resting tile spends is the price
 * chip; the border and glow arrive on hover, so the red is a response rather
 * than a decoration on every tile at once.
 *
 * ---------------------------------------------------------------------------
 * No state, no event handlers: a Server Component that ships no JavaScript.
 */

/** `available` is implied by the page; only exceptions are badged. */
const STATUS_TONES: Record<Vehicle["status"], BadgeTone> = {
  available: "success",
  reserved: "warning",
  sold: "neutral",
};

const EXCEPTION_STATES: readonly Vehicle["status"][] = ["reserved", "sold"];

export function VehicleCard({
  vehicle,
  headingLevel = 3,
  className,
}: {
  vehicle: Vehicle;
  /**
   * The tile's title is a real heading so a screen reader can jump between
   * vehicles. `3` inside the inventory section, which supplies the `h2`; the
   * prop exists so reusing the card on a page with a different outline does not
   * force a `div` back into the accessibility tree.
   */
  headingLevel?: 2 | 3;
  className?: string;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const image = vehicle.images[0] ?? null;

  // Absent specifications are dropped rather than rendered as a placeholder, so
  // the row is as short as the data actually is.
  const specs = [
    String(vehicle.year),
    vehicle.transmission,
    vehicle.fuel,
    vehicle.bodyType,
    vehicle.mileage === null ? null : formatMileage(vehicle.mileage),
  ].filter((value): value is string => value !== null);

  const title = vehicleTitle(vehicle);

  return (
    <Surface
      as="article"
      interactive
      // `relative` establishes the containing block for the title link's stretched
      // `after` overlay, so the hit area is the card rather than the page.
      //
      // `group` is what carries the hover story to the children that need it -
      // the photograph's zoom and the title's colour shift - which cannot be
      // expressed by styling this element alone.
      //
      // `interactive` hands the hover story to `Surface`, which owns it in one
      // place now: red border, red glow, a small lift, and the `focus-within`
      // mirror of all three. It used to be spelled out here as
      // `hover:border-accent-600 hover:shadow-md`, which was tuned against the
      // old light canvas and would not have produced the right result on black.
      //
      // `group` is still needed and is still doing something different: it
      // carries the photograph's zoom and the title's colour shift, which are
      // properties of the children rather than of the card.
      className={cn("group relative flex w-full flex-col overflow-hidden", className)}
    >
      {/*
        The image area is a fixed ratio box rather than an intrinsically-sized
        one, so every tile in the grid is the same height whether or not it has
        a photograph. A grid of tiles that resize as images load is the most
        visible layout fault a listing page can have.

        `overflow-hidden` contains the hover zoom, which would otherwise push
        the photograph past the card's rounded corners.
      */}
      <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-line bg-sunken">
        {image ? (
          <Image
            src={image.src}
            // Meaningful alt from the data, per the `VehicleImage` contract.
            alt={image.alt}
            width={image.width}
            height={image.height}
            // `sizes` is what stops the browser downloading a 2000px original
            // for a 300px tile. The 50vw/100vw figures are the tile's share of
            // a 1/2/3-column grid.
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="size-full object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-standard)] group-hover:scale-[1.04]"
          />
        ) : (
          /*
            No photograph. A framed car glyph on the sunken surface, in the same
            outlined-square treatment the services cards use for their icons, so
            the placeholder reads as a deliberate part of the system rather than
            as a missing asset. Marked decorative: the vehicle is already named
            immediately below, so announcing "car icon" adds noise, not meaning.
          */
          <div className="flex size-full items-center justify-center">
            <span
              aria-hidden="true"
              className="inline-flex size-10 items-center justify-center rounded-sm border border-line text-fg-muted"
            >
              <Car className="size-5" />
            </span>
          </div>
        )}

        {/*
          A short scrim from the top edge. Real photography is unpredictable - a
          pale sky shot and a dark night shot both land here - and a status badge
          sitting directly on the image has to stay legible against either. It is
          black at partial opacity, which works on any photograph.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.45),transparent)]"
        />

        {EXCEPTION_STATES.includes(vehicle.status) ? (
          <Badge tone={STATUS_TONES[vehicle.status]} dot className="absolute top-3 left-3">
            {VEHICLE_STATUS_LABELS[vehicle.status]}
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-col gap-1.5">
          {/*
            One link, stretched over the whole tile.

            The heading wraps the link and the link's `after` pseudo-element
            covers the card, so the entire tile is clickable while the
            accessibility tree still contains exactly one link with a name that
            says what it is. The alternative - also linking the image - would
            produce two links to the same place, which is noise a screen reader
            user has to listen to twice and which duplicates the destination in
            the tab order.

            The WhatsApp action below is `relative`, so it sits above the stretched
            overlay and stays independently clickable and focusable. Nesting a
            button inside a link would be invalid HTML, which is why the overlay
            approach is used rather than wrapping the card contents.
          */}
          <Heading className="text-h4 text-fg text-balance transition-colors duration-[var(--duration-fast)] group-hover:text-fg-accent">
            <Link
              href={vehiclePath(vehicle.slug)}
              className="after:absolute after:inset-0 after:content-['']"
            >
              {title}
            </Link>
          </Heading>

          {vehicle.variant ? (
            <p className="text-body-sm text-fg-secondary">{vehicle.variant}</p>
          ) : null}
        </div>

        {/*
          Specification row. `tnum` because these are numerals that get compared
          vertically down a column of tiles, which is the case the design system
          reserves it for. The gap is a real character so the list still reads
          correctly if a style ever fails to load.
        */}
        <p className="tnum text-caption text-fg-muted">
          {specs.join("  ·  ")}
        </p>

        {/*
          The price block, on a rule of its own so the number reads as the
          tile's bottom line rather than as another line of specifications.

          `mt-auto` keeps it on a consistent baseline across a row of tiles whose
          title and variant lengths differ.

          Two treatments, both from the token layer and neither from a component
          of its own:

            - a live price, or a request for one, gets the brand accent as a
              filled chip with near-black type. That is the same
              `action-accent` / `action-accent-content` pairing the primary
              button uses, so the number on the card and the button that offers
              to act on it are visibly the same thing. Most of the inventory is
              "Price on request", so this treatment has to carry those cards
              too - a muted line reading "Price on request" would read as a
              missing price rather than as an offer.

            - a sold vehicle is the one case that must not shout. It gets the
              neutral sunken chip, because a red price on a car that is no
              longer available is a claim the tile should not be making.

          `tnum` because these are the figures being compared down the column.
        */}
        <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p
              className={cn(
                "tnum inline-flex items-center rounded-xs px-2.5 py-1 text-body-sm font-semibold uppercase tracking-[0.06em]",
                vehicle.status === "sold"
                  ? "border border-line bg-sunken text-fg-secondary"
                  : "bg-action-accent text-action-accent-content",
              )}
            >
              {formatVehiclePrice(vehicle)}
            </p>

            {/*
              A destination hint, not a second link. The stretched overlay above
              already carries the tile to this vehicle, so another link here
              would put the same address in the tab order twice; and the words
              restate what the tile's own link already announced, so they are
              hidden from assistive technology and exist for a sighted pointer.
            */}
            <span
              aria-hidden="true"
              className="flex items-center gap-1 text-caption text-fg-muted"
            >
              View details
              <ArrowUpRight className="size-3.5" />
            </span>
          </div>

          {vehicle.location ? (
            <p className="flex items-center gap-1.5 text-caption text-fg-muted">
              <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
              {vehicle.location}
            </p>
          ) : null}
        </div>

        {/*
          The enquiry action, pre-filled with this vehicle's reference so the
          message arrives already identifying the car. Renders nothing until
          `NEXT_PUBLIC_WHATSAPP_NUMBER` is set - see the note at the top.

          `relative` keeps it above the title link's stretched overlay. The
          `z-10` is what actually guarantees it: both are positioned, and a
          positioned element later in the source order would win anyway, but
          relying on source order for a click target is fragile.
        */}
        <WhatsAppCta
          className="relative z-10 mt-1 self-start"
          variant="outline"
          size="sm"
          label="Enquire"
          ariaLabel={`Enquire about this ${title}`}
          message={`Hello Humera Automobile, I would like to enquire about the ${vehicle.year} ${title}.`}
        />
      </div>
    </Surface>
  );
}
