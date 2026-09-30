"use client";

/**
 * A single vehicle card.
 *
 * ---------------------------------------------------------------------------
 * Why there is exactly one link, and it covers the whole card
 * ---------------------------------------------------------------------------
 * The brief asks for a keyboard-focusable card *and* a visible "View details →"
 * link in the footer. Implemented literally - a focusable card plus a second link
 * - that produces two tab stops and two screen-reader announcements for the same
 * destination, and a screen-reader user hears the car's name twice.
 *
 * So the card uses the stretched-link pattern instead, which is what
 * `features/vehicles/components/vehicle-card.tsx` already does and documents:
 *
 *   - the heading contains the one real link, whose `::after` is stretched over
 *     the card, so the whole tile is clickable and the accessibility tree still
 *     holds a single link with a meaningful name
 *   - the card takes the focus ring via `focus-within`, so tabbing to it shows
 *     exactly the emphasis hovering shows
 *   - "View details →" is a visual hint, not a second link: `aria-hidden` and
 *     `pointer-events-none`, because the link underneath already goes there
 *
 * The alternative - `tabIndex={0}` on the `<article>` - would add a focus stop
 * that is not a link, which breaks Enter-to-activate and confuses assistive
 * technology about what the card is.
 *
 * ---------------------------------------------------------------------------
 * Why the image cannot fail visibly
 * ---------------------------------------------------------------------------
 * Every Unsplash URL in the current data 404s, and `next/image` renders a failed
 * image's `alt` text - which is how "Toyota Hilux Rocco 2.8 - image 1" ended up
 * printed on a black box. Two things prevent that here:
 *
 *   1. `alt=""`, because the adjacent heading inside the same link already names
 *      the car. An image whose alt repeats the link text is announced twice, so
 *      the image is decorative *relative to the link* and says nothing. With an
 *      empty alt there is no text to fall back to, so the failure is invisible
 *      even before `onError` fires.
 *   2. `onError` swaps in a designed placeholder, so a dead URL shows a dark
 *      gradient with a car glyph rather than a broken-image box.
 *
 * When real photography is uploaded through the staff area it arrives with its
 * own `alt` from the uploader, and `ShowroomCar.imageAlt` can carry it. It is left
 * out of the mapped shape on purpose: inventing a description nobody wrote is
 * worse than none.
 */

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { ArrowUpRight, Car } from "@/components/icons";
import type { ShowroomCar } from "@/features/home/lib/showroom-cars";
import { cn } from "@/lib/cn";

/**
 * The designed placeholder for a car with no usable photograph.
 *
 * Drawn rather than left blank so an unphotographed car reads as a deliberate part
 * of the system rather than as a missing asset - the same treatment
 * `vehicle-card.tsx` uses for its no-photo branch.
 */
function ImageFallback() {
  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center",
        // A gradient of two surfaces rather than two hues, so the placeholder
        // cannot shift the perceived colour of the photography that replaces it.
        "bg-[linear-gradient(145deg,var(--surface-sunken),var(--surface-raised))]",
      )}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-12 items-center justify-center rounded-card border border-line text-fg-muted"
      >
        <Car className="size-6" />
      </span>
    </div>
  );
}

export function CarCard({ car }: { car: ShowroomCar }) {
  // `boolean` rather than a string sentinel, because the state has two
  // distinguishable cases worth keeping apart: no `src` supplied at all, and a
  // `src` that 404s.
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-card border border-line bg-raised",
        "transition-[transform,border-color,box-shadow] duration-200 ease-[var(--ease-standard)]",
        // The 4px lift and the red border, both on hover *and* on focus-within.
        "hover:-translate-y-1 hover:border-accent-500 hover:shadow-[var(--shadow-glow-red)]",
        "focus-within:-translate-y-1 focus-within:border-accent-500 focus-within:shadow-[var(--shadow-glow-red)]",
      )}
    >
      {/*
        16:10 rather than 4:3. A 16:10 frame is shorter, which lets three rows of
        cards sit in a viewport without scrolling, and it crops less off a
        landscape photograph than 4:3 does.
      */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-sunken">
        {/*
          The null check and the error flag are tested inline rather than through
          a `showFallback` boolean computed above. TypeScript narrows a value
          inside a conditional's else branch but not through a boolean that
          captured the same condition, so the local variable version leaves `src`
          typed `string | null` here and fails to compile.
        */}
        {car.image === null || imageFailed ? (
          <ImageFallback />
        ) : (
          <Image
            src={car.image}
            // Empty alt on purpose - see the note at the top of this file.
            alt=""
            fill
            // Tells Next how wide the image is rendered so it can pick a sensible
            // source size. The tile is one of 3 / 2 / 1 columns at each breakpoint.
            sizes="(min-width: 1280px) 400px, (min-width: 768px) 45vw, 92vw"
            className="object-cover transition-transform duration-500 ease-[var(--ease-standard)] group-hover:scale-[1.04]"
            onError={() => setImageFailed(true)}
          />
        )}

        {/*
          A top scrim. Photography is unpredictable - a pale sky shot and a dark
          studio shot both land here - and the badge sits directly on the image, so
          it needs a guaranteed contrast floor regardless of the photograph. Black
          at partial opacity is the one scrim that works over both.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.55),transparent)]"
        />

        <span
          className={cn(
            "absolute top-3 left-3 rounded-pill px-2.5 py-1 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase",
            car.type === "new"
              ? "bg-action-accent text-action-accent-content"
              : "border border-line-control bg-black/60 text-fg-inverse backdrop-blur-sm",
          )}
        >
          {car.type === "new" ? "New" : "Used"}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        {/*
          The heading holds the one link. `after:absolute after:inset-0` stretches
          its hit area over the whole card, so the entire tile is clickable while
          the accessibility tree still contains exactly one link named after the
          car.
        */}
        <h3 className="text-[1.125rem] font-semibold text-balance text-fg">
          {car.href ? (
            <Link
              href={car.href}
              className={cn(
                "after:absolute after:inset-0 after:content-['']",
                "transition-colors duration-200 group-hover:text-fg-accent group-focus-within:text-fg-accent",
              )}
            >
              {car.name}
            </Link>
          ) : (
            // No `href` means the data has no slug to link to. Rendering a
            // non-interactive heading is correct: an anchor to nowhere is worse
            // than a card that is not clickable.
            <span>{car.name}</span>
          )}
        </h3>

        {/*
          The specs line. `min-h` reserves one line even when a car has no specs
          recorded, so a grid of cards whose data varies in completeness still has
          its price rows aligned. Without it, one sparsely-recorded car shifts
          everything below it by a line.
        */}
        <p className="mt-1.5 min-h-4 text-[0.8125rem] text-fg-muted">
          {car.specs}
        </p>

        {/*
          The footer. `mt-auto` pins it to the bottom of the card so prices sit on
          a common baseline across a row regardless of how long the names above
          them are.
        */}
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-4">
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-[1.0625rem] font-semibold",
                // A withheld price is de-emphasised rather than presented as an
                // offer. "Price on request" is a legitimate state, not a missing
                // value, and rendering it at full weight in the accent colour
                // would imply a figure exists.
                car.priceKnown ? "text-fg" : "text-fg-secondary",
              )}
            >
              {car.price}
            </p>
            <p className="mt-0.5 text-[0.6875rem] tracking-[0.08em] text-fg-muted uppercase">
              Inspected
            </p>
          </div>

          {/*
            A destination hint, not a second link. The stretched overlay above
            already carries the card to this vehicle, so another anchor here would
            put the same address in the tab order twice, and the words restate what
            the heading's link already announced.
          */}
          <span
            aria-hidden="true"
            className="pointer-events-none flex shrink-0 items-center gap-1 text-[0.8125rem] font-semibold text-fg-accent"
          >
            View details
            <ArrowUpRight className="size-3.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
