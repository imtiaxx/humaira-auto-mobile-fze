import Image from "next/image";
import Link from "next/link";

import { WhatsAppCta } from "@/components/cta/whatsapp-cta";
import { Car, MapPin } from "@/components/icons";
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
 * fixed intrinsic box and AVIF/WebP. The repository has no vehicle photography
 * yet, so `images` is empty and the placeholder branch is what renders today.
 * When a CDN host is added, its `remotePatterns` entry belongs in the same
 * commit as the first real `src` - `next.config.ts` says so at the list.
 *
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
      // `relative` establishes the containing block for the title link's stretched
      // `after` overlay, so the hit area is the card rather than the page.
      className={cn("relative flex w-full flex-col overflow-hidden", className)}
    >
      {/*
        The image area is a fixed ratio box rather than an intrinsically-sized
        one, so every tile in the grid is the same height whether or not it has
        a photograph. A grid of tiles that resize as images load is the most
        visible layout fault a listing page can have.
      */}
      <div className="relative aspect-[4/3] w-full border-b border-line bg-sunken">
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
            className="size-full object-cover"
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
          <Heading className="text-h4 text-fg text-balance">
            <Link
              href={vehiclePath(vehicle.slug)}
              className="after:absolute after:inset-0 after:content-[''] hover:underline"
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
          The price line, pushed to the bottom of the tile with `mt-auto` so it
          sits on a consistent baseline across a row of tiles whose description
          lengths differ. It is the number a buyer scans for, so it gets
          `text-fg` at body weight rather than being styled as secondary text.

          `formatVehiclePrice` is shared with the detail page, so the two can never
          disagree about how a car is priced. It also decides the "Sold" case, so
          this line does not branch on status itself.
        */}
        <div className="mt-auto flex flex-col gap-1 pt-1">
          <p className="text-body font-semibold text-fg">{formatVehiclePrice(vehicle)}</p>

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
