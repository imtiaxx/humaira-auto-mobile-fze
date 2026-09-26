import { Container } from "@/components/ui/container";

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

      <Container className="py-14 sm:py-16 lg:py-20">
        <div className="flex max-w-3xl flex-col gap-4">
          {/* The page's only `h1`. Nothing below it may introduce another. */}
          <h1 id="inventory-heading" className="text-display text-fg text-balance">
            Vehicle inventory
          </h1>

          <p className="text-body-lg text-fg-secondary text-pretty">
            Vehicles available through Humera Automobile in Dubai, and vehicles we
            can source on request. Tell us the make, model, year and budget you
            are working to and we will come back to you with what is available.
          </p>
        </div>
      </Container>
    </section>
  );
}
