import Link from "next/link";

import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button-styles";

/**
 * The inventory page header.
 *
 * ---------------------------------------------------------------------------
 * Why this is a deep band rather than a light one
 * ---------------------------------------------------------------------------
 * Step 6 established a `on-inverse` scope and used it for the homepage hero, the
 * conversion panel and the footer. This page reuses that scope for its own
 * header, which is the point of having put the palette in the token layer: the
 * deep treatment is available to any page without a single new colour value
 * and without touching the design system.
 *
 * It is deliberately a quieter composition than the homepage hero - no artwork,
 * tighter padding, no oversized headline. A catalogue page is a working surface
 * and its first job is to orient, not to impress a visitor who has already
 * decided to look at cars.
 *
 * ---------------------------------------------------------------------------
 * Every word is traceable
 * ---------------------------------------------------------------------------
 * "Dubai" and the trading/description of the business come from
 * `config/site.ts`. Sourcing by "make, model, year and budget" is the request the
 * navigation already models as "Request a Vehicle" and the homepage already
 * states. There is no count of vehicles, no "hundreds of cars", no price
 * promise and no turnaround claim anywhere on this page, because none of those
 * numbers exist to state.
 */
export function InventoryHeader() {
  return (
    <section
      /*
        `aria-labelledby` rather than `aria-label`, for the reason given on the
        homepage hero: the visible headline is the section's name, and a screen
        reader should announce the same words a sighted visitor reads.
      */
      aria-labelledby="inventory-heading"
      className="on-inverse relative overflow-hidden border-b border-line bg-page"
    >
      {/*
        The same soft lift behind the hero copy on the homepage, drawn from
        `--surface-raised` so it is a gradient of one surface onto another and
        cannot shift the perceived contrast of the type above it. Decorative,
        and behind the content.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_60%_60%_at_30%_0%,var(--surface-raised),transparent)]"
      />

      {/*
        The brand's one piece of colour on the page. A second, much smaller
        gradient in `--color-accent-700` on the opposite side, held at low
        opacity so it reads as depth behind the copy rather than as a red glow
        competing with the headline. It is the same accent the CTA, the active
        nav rule and the price chips use, so the page has one colour story.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_45%_55%_at_88%_8%,var(--color-accent-700),transparent)] opacity-25"
      />

      {/* A single red hairline along the top edge, the page's strongest accent. */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-0.5 bg-action-accent" />

      <Container className="py-14 sm:py-16 lg:py-20">
        <div className="flex max-w-3xl flex-col gap-4">
          {/*
            The eyebrow carries the red on this band. A short red rule ahead of
            the words is a catalogue convention, and it means the colour appears
            in the type's own rhythm rather than only behind it.
          */}
          <p className="flex items-center gap-3 text-label text-fg-accent uppercase">
            <span aria-hidden="true" className="h-px w-8 bg-action-accent" />
            Dubai showroom
          </p>

          {/* The page's only `h1`. Nothing below it may introduce another. */}
          <h1 id="inventory-heading" className="text-display text-fg text-balance">
            Vehicle inventory
          </h1>

          <p className="text-body-lg text-fg-secondary text-pretty">
            Vehicles available through Humera Automobile in Dubai, and vehicles we
            can source on request. Tell us the make, model, year and budget you
            are working to and we will come back to you with what is available.
          </p>

          {/*
            The one action this band offers, pointing at the listings further
            down the same page - so it is an in-page anchor, not a new route, and
            it cannot 404. `buttonClasses` is imported from the recipe module
            rather than the `Button` component because this is a Server Component
            and `Button` is a client island; the recipe is the same one, without
            the client boundary. `scroll-mt` on the target heading clears the
            sticky header when the jump lands.
          */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-3">
            <Link href="#listings-heading" className={buttonClasses("accent", "lg")}>
              Browse available vehicles
            </Link>
            <span className="text-caption text-fg-muted">
              All prices in USD &middot; sourcing on request
            </span>
          </div>
        </div>
      </Container>
    </section>
  );
}
