import Link from "next/link";

import { buttonClasses } from "@/components/ui/button-styles";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/states";
import { InventoryCta } from "@/features/vehicles/components/inventory-cta";
import { makePath, type Brand } from "@/features/vehicles/lib/brands";

/**
 * The brand directory.
 *
 * ---------------------------------------------------------------------------
 * Why the header is part of this component
 * ---------------------------------------------------------------------------
 * `InventoryHeader` exists because the inventory page is a band plus three
 * sections, so its `h1` is separable. This page is a band plus one section, and
 * splitting two files out of one composition buys nothing. More importantly the
 * `h1` must not be reachable from a second code path: the empty state and the
 * listing are genuinely different pages to a screen reader, and a header that
 * could be omitted by a future edit is a page with no `h1` at all.
 *
 * So the header renders unconditionally and the section below it decides what it
 * contains. `aria-labelledby` on the section points at the `h2` that section
 * owns, which is never rendered in the empty branch - see that branch for why.
 *
 * ---------------------------------------------------------------------------
 * What this page is allowed to claim
 * ---------------------------------------------------------------------------
 * Every name, count, model and price rendered here comes from a published
 * vehicle, which is the whole reason the directory is derived (`lib/brands.ts`)
 * rather than written down.
 *
 * That constraint shapes the component. There is no logo, no brand blurb, no
 * founding year, no country of origin and no "we also stock" line per make,
 * because none of those exist in the data, and inventing them is the failure
 * this repository refuses to ship. A dealer directory written in adjectives
 * reads better and is worth less: every fact here can be checked against the
 * inventory, and when the last Patrol is archived the Nissan entry is gone on the
 * next request with nobody remembering to edit a page.
 *
 * ---------------------------------------------------------------------------
 * Why each make links to a *filtered* inventory
 * ---------------------------------------------------------------------------
 * The destination is `/inventory?make=…`, the query-string contract the filter
 * control established. This page therefore adds no route of its own for "vehicles
 * in this make" and no second listing component: the directory is a shortcut into
 * the real inventory, and there is exactly one place that renders vehicles, so a
 * car cannot be shown here under different rules than there.
 *
 * The integration is one-directional. This page reads the make filter's contract;
 * it does not change it.
 */
export function BrandDirectory({ brands }: { brands: readonly Brand[] }) {
  /*
    The one number the page states about itself. Summed from the derived brands
    rather than fetched separately, so the figure under the directory is
    reconciled with the rows above it by construction: two requests could
    disagree if a vehicle were published between them, and a page whose own total
    contradicts its own list is the kind of detail a visitor notices.
  */
  const total = brands.reduce((sum, brand) => sum + brand.count, 0);

  return (
    <div className="on-inverse bg-page">
      <section
        aria-labelledby="brands-heading"
        className="relative overflow-hidden border-b border-line"
      >
        {/*
          The same two soft lifts behind the inventory header, and the same red
          hairline. Reusing the composition is the point of having put the palette
          in the token layer: this page reads as part of the same catalogue without
          a single new colour value.
        */}
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
              Dubai showroom
            </p>

            {/* The page's only `h1`. Nothing below it may introduce another. */}
            <h1 id="brands-heading" className="text-display text-fg text-balance">
              Brands we stock
            </h1>

            <p className="text-body-lg text-fg-secondary text-pretty">
              {brands.length > 0
                ? "Every make below has at least one vehicle published on this site right now. Open a make to see the vehicles we have in stock, filtered to that brand."
                : "Vehicles are added to this site as they are published. Our listings are not available online at the moment, so there is no directory to show."}
            </p>
          </div>
        </Container>
      </section>

      {/*
        The empty branch, which is a real state rather than an error. Every
        vehicle can be archived, and a business that has withdrawn its last
        listing still needs this page to tell the truth - silently rendering a
        heading over nothing would be a lie, and a "no results" grid would
        suggest the filters failed when there is nothing to filter.

        No `h2` here, for the same reason the section is not rendered in the
        populated branch either: the header is this page's one section, and there
        is nothing under it to name. The `h1` is not orphaned - it is the only
        heading, which is a valid outline.
      */}
      {brands.length === 0 && (
        <Container className="py-14 sm:py-16 lg:py-20">
          <EmptyState
            title="No makes are published on this site yet"
            description="Vehicles are added here as they are published, and there are none at the moment. That does not mean we have nothing to sell: our stock turns over in Dubai, and vehicles are often available before they are listed online. Tell us the make, model, year and budget you are working to and we will tell you what is available and arrange a viewing."
          />
        </Container>
      )}

      {brands.length > 0 && (
        <section aria-labelledby="brands-list-heading">
          <Container className="py-14 sm:py-16 lg:py-20">
            <h2 id="brands-list-heading" className="text-h2 text-fg">
              {brands.length === 1 ? "1 make in stock" : `${brands.length} makes in stock`}
            </h2>

            {/*
              One flat list in source order. Deliberately not a grid of cards:
              a grid implies the entries are peers to be scanned in any order, and
              a brand directory has a natural order - alphabetical, which
              `toBrandDirectory` has already applied - plus a small, fixed set of
              entries. Presenting it in rows means the page is identical at every
              catalogue size, and it stays legible when a make has fifteen models
              instead of four. The `rule-top` utility gives the same separation the
              grid's borders would have.
            */}
            <ul className="mt-8 flex flex-col">
              {brands.map((brand) => (
                <li key={brand.name} className="rule-top">
                  <BrandRow brand={brand} />
                </li>
              ))}
            </ul>

            {/*
              The closing route back to the unfiltered catalogue, and the reason
              this page is not a dead end in either direction: a visitor who arrived
              from the inventory can widen, and a visitor who arrived here can
              narrow. It points at the existing `/inventory` route rather than at
              anything new, so it resolves to a page that already exists, and the
              total beside it is summed from the rows above rather than fetched
              separately.
            */}
            <div className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-3">
              <Link href="/inventory" className={buttonClasses("accent", "lg")}>
                See all vehicles
              </Link>
              <span className="text-caption text-fg-muted">
                {total} {total === 1 ? "vehicle" : "vehicles"} across {brands.length}{" "}
                {brands.length === 1 ? "make" : "makes"}
              </span>
            </div>
          </Container>
        </section>
      )}

      {/*
        The sourcing panel, in both states, exactly as `/inventory` does.

        Reused rather than rewritten: it is the site's single enquiry route, and
        a second copy of it would be a second place to change the message, the
        number source and the disabled-when-unconfigured behaviour. Keeping one
        means the brands page cannot drift away from the rest of the site on the
        one thing that has to work.

        It is the whole answer in the empty state - "nothing is published" is
        precisely the situation a sourcing service exists for - and it is the
        closing note when the directory is populated, for a visitor whose make is
        not listed because we have not published it yet.
      */}
      <InventoryCta />
    </div>
  );
}

/**
 * One make.
 *
 * ---------------------------------------------------------------------------
 * Why the row is a heading, not a card
 * ---------------------------------------------------------------------------
 * Three brands in the live inventory is three rows, not a three-tile hero grid.
 * A grid of oversized cards would be a page that looks like a template, and the
 * whole argument of deriving this list from real stock is that it is a working
 * catalogue rather than decoration. The row is also what scales: one hundred
 * makes stay a readable index, and each row can carry a longer model list than a
 * fixed-height tile could.
 *
 * ---------------------------------------------------------------------------
 * The one action
 * ---------------------------------------------------------------------------
 * A single "See X vehicles" link, and not a whole-row link. A row that is itself
 * an anchor has to suppress the selection of the model names beside it, which
 * costs `user-select: none` and makes text nobody needs to select unselectable -
 * and the visible affordance is the link text, so making the row clickable on top
 * of it makes the real target unguessable. One link, one target, and the row still
 * reads as a row.
 */
function BrandRow({ brand }: { brand: Brand }) {
  const vehicles = brand.count === 1 ? "1 vehicle" : `${brand.count} vehicles`;

  return (
    <div className="py-8 sm:py-10">
      <div className="flex flex-col gap-x-10 gap-y-4 md:flex-row md:items-baseline md:justify-between">
        <div className="min-w-0">
          <h3 className="text-h3 text-fg text-balance">{brand.name}</h3>

          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-fg-secondary">
            <span className="tnum">{vehicles}</span>
            {/* Count and range are the two facts a customer scans for. */}
            <span aria-hidden="true" className="text-fg-muted">
              &middot;
            </span>
            <span className="tnum">{priceRange(brand)}</span>
          </p>

          {/*
            The model list, as text. With four models it reads as a sentence; as a
            row of pills it would be a design gesture, and with forty it would be an
            unreadable block. The purpose of the line is to answer "is this make
            worth opening" - the full list lives one click away, filtered.
          */}
          <p className="mt-3 max-w-2xl text-body-sm text-fg-muted text-pretty">
            {brand.models.join(", ")}
          </p>
        </div>

        <div className="shrink-0 md:pt-1">
          <Link href={makePath(brand.name)} className={buttonClasses("secondary", "md")}>
            See {vehicles}
            <span className="sr-only"> for {brand.name}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * The price range as a phrase, or the honest absence of one.
 *
 * Mirrors `formatVehiclePrice`: a single figure is not a range, and no figure at
 * all is not `$0`. Written here rather than imported because it is a different
 * phrase - a range across a make, not a price for one car - and because
 * `toLocaleString` is called on a number this file has already established is
 * non-null.
 */
function priceRange(brand: Brand): string {
  const { minPrice, maxPrice } = brand;
  const money = (value: number) => `$${value.toLocaleString("en-US")}`;

  if (minPrice === null || maxPrice === null) return "Price on request";
  if (minPrice === maxPrice) return money(minPrice);

  return `${money(minPrice)} to ${money(maxPrice)}`;
}
