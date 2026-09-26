import Image from "next/image";

import { Car } from "@/components/icons";
import type { Vehicle } from "@/types/vehicle";

/**
 * The vehicle's photography.
 *
 * ---------------------------------------------------------------------------
 * No carousel, and that is a design decision rather than a saving
 * ---------------------------------------------------------------------------
 * A gallery with arrows, dots, swipe and a lightbox needs client state, a
 * `"use client"` boundary, and keyboard/focus management for a tablist. This one
 * has none of that: it is a Server Component that renders the primary image
 * large and any further images as a static grid beneath it.
 *
 * The interaction is genuinely not required. A buyer assessing a car wants to see
 * it, and scrolling past two or three large images serves that better than
 * clicking through them one at a time. It also means the page works with
 * JavaScript disabled, indexes every image for search, and cannot strand a
 * visitor on an empty lightbox. When the photography genuinely calls for a
 * carousel, that is the moment to add one - and it will be a change to this file
 * alone.
 *
 * ---------------------------------------------------------------------------
 * The placeholder is a state, not a stand-in for a photograph
 * ---------------------------------------------------------------------------
 * There is no vehicle photography in the repository, so this branch is what
 * renders today. It is the same outlined glyph on the same sunken surface the
 * Step 7 card uses, so a car with no photo looks the same here as it does in the
 * grid rather than like a different, broken page.
 *
 * Crucially the placeholder is never captioned as though it were a photograph,
 * and no stock image is substituted for a missing one. A grey panel with a car
 * glyph says "no photograph yet", which is true; a stock photo of someone else's
 * car says something false. It is marked `aria-hidden` because the vehicle is
 * named in the heading directly below - announcing "car icon" adds nothing.
 *
 * ---------------------------------------------------------------------------
 * Ratios
 * ---------------------------------------------------------------------------
 * `aspect-[4/3]` on the primary image, matching the card, so a vehicle looks the
 * same at thumbnail and full size and the grid and the detail page agree about a
 * car's proportions. `object-cover` fills the fixed box, so a photograph of any
 * aspect ratio cannot introduce a scrollbar or a letterboxed gap. The fixed box
 * is also what stops the page reflowing as images arrive.
 *
 * Supporting images use `aspect-square` in a grid that collapses to one column on
 * a phone. There is no `sizes` mistake available here: the primary image is full
 * width and the rest are one third of the row, so the hints below match the
 * layout.
 */
export function VehicleGallery({ vehicle }: { vehicle: Vehicle }) {
  const [primary, ...supporting] = vehicle.images;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-card border border-line bg-sunken">
        {primary ? (
          <Image
            src={primary.src}
            // Meaningful alt from the data, per the `VehicleImage` contract.
            alt={primary.alt}
            width={primary.width}
            height={primary.height}
            // Full-width hero: 100vw below the large breakpoint, then the
            // two-thirds of a split layout it actually occupies.
            sizes="(min-width: 1024px) 62vw, 100vw"
            // The first photograph is the page's largest contentful paint on a
            // vehicle page, so it is worth having; the rest can wait.
            priority={supporting.length === 0}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex size-12 items-center justify-center rounded-sm border border-line text-fg-muted"
            >
              <Car className="size-6" />
            </span>
            <p className="px-6 text-center text-caption text-fg-muted">
              No photograph available for this vehicle
            </p>
          </div>
        )}
      </div>
          {/*
            Supporting images. Only rendered when there is more than one
            photograph, so the single-image case is a single clean image with no
            stray grid. A `<ul>` because this is a set of images.
          */}
          {supporting.length > 0 ? (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {supporting.map((image) => (
                <li key={image.src}>
                  <div className="relative aspect-square w-full overflow-hidden rounded-card border border-line bg-sunken">
                    <Image
                      src={image.src}
                      alt={image.alt}
                      width={image.width}
                      height={image.height}
                      sizes="(min-width: 1024px) 31vw, (min-width: 640px) 50vw, 100vw"
                      className="size-full object-cover"
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
    </div>
  );
}
