import type { Metadata } from "next";

import { InventoryCta } from "@/features/vehicles/components/inventory-cta";
import { InventoryHeader } from "@/features/vehicles/components/inventory-header";
import { SourcingCriteria } from "@/features/vehicles/components/sourcing-criteria";
import { VehicleGrid } from "@/features/vehicles/components/vehicle-grid";
import { listVehicles } from "@/features/vehicles/lib/inventory";
import { SITE_NAME } from "@/config/site";

/**
 * The vehicles / inventory page.
 *
 * ---------------------------------------------------------------------------
 * Why this route is `/inventory` and not `/vehicles`
 * ---------------------------------------------------------------------------
 * The navigation config already decides this, and this page follows it rather
 * than introducing a second URL for the same content.
 *
 * `navigation/config.ts` declares the primary nav item as `label: "Inventory"`
 * with `path: "/inventory"`, and the footer group *titled* "Vehicles" contains
 * an "Inventory" entry pointing at the same path. So "Vehicles" is the name of
 * the section in the site's information architecture, and `/inventory` is the
 * route. Adding a `/vehicles` route as well would create two addresses for one
 * page, split the navigation's own vocabulary, and mean the footer group and the
 * header pointed at different names for the same destination.
 *
 * When this page landed, the two `Inventory` items in that config were promoted
 * from `status: "planned"` to `status: "live"` - which is the one-line change
 * the file's own documentation describes, and which the compiler immediately
 * checks against the real route.
 *
 * ---------------------------------------------------------------------------
 * Metadata
 * ---------------------------------------------------------------------------
 * `title` is a plain string, so the root layout's `title.template` applies and
 * this renders as "Vehicle inventory | Humera Automobile". The homepage has to
 * use `title.absolute` because it shares the `/` segment with the layout that
 * defines the template; this page does not, and inventing that workaround here
 * would drop the brand from the title for no reason.
 *
 * `robots` is deliberately **not** set on this page. The root layout already
 * declares the whole site `index: false, follow: false` while it has no public
 * content, and an inventory page with nothing in it is not something to submit
 * to a search engine. Repeating the directive here would duplicate a global
 * decision and create a second place to forget to change it when the site does
 * become indexable.
 *
 * `alternates.canonical` follows the homepage's convention of pinning the one
 * true address for the route.
 *
 * `openGraph` is written out in full rather than as the `openGraph: { url }` one-
 * liner the homepage uses. That is deliberate. Next merges metadata between
 * segments **shallowly**: "metadata with nested fields such as `openGraph` and
 * `robots` that are defined in an earlier segment are overwritten by the last
 * segment to define them." So a page-level `openGraph: { url }` does not extend
 * the root layout's object - it replaces it wholesale, and `og:type`,
 * `og:site_name` and `og:locale` silently disappear from the rendered tags.
 *
 * Restating the three fields keeps this page correct on its own terms. They come
 * from the same `SITE_NAME` and the same locale as the root layout, so there is
 * still one definition of each value in the project.
 */
export const metadata: Metadata = {
  title: "Vehicle inventory",
  description:
    "Browse vehicles available through Humera Automobile in Dubai, or ask us to source a vehicle by make, model, year and budget. Vehicle sourcing and export from our Ras Al Khor showroom.",
  alternates: { canonical: "/inventory" },
  openGraph: {
    url: "/inventory",
    // Restated rather than inherited - see the note above on shallow merging.
    type: "website",
    siteName: SITE_NAME,
    locale: "en_AE",
  },
};

export default async function InventoryPage() {
  // The one call that will change shape when there is a real inventory source.
  const vehicles = await listVehicles();

  return (
    /*
      `on-inverse` opens the deep palette for this whole page. The wrapper is the
      only thing that changed visually at page level: every `bg-page`,
      `text-fg`, `text-fg-secondary`, `border-line` and `bg-raised` beneath it
      resolves to its inverse value, so the sections below were already written
      against the token layer and now read as one near-black marketplace without
      a single new colour value being introduced.

      The header and footer live in the marketing layout, outside this wrapper,
      so they keep the treatment they have on every other public page.
    */
    <div className="on-inverse bg-page">
      {/*
        `InventoryHeader` owns the page's only `h1`. Every section below it
        starts at `h2`, so the outline is h1 > h2 with nothing skipped.

        Section order follows the brief and, more importantly, the order a
        visitor needs it in: orient, learn how sourcing works, see what is
        listed, then act. The conversion panel is last because it is the answer
        to everything above it.
      */}
      <InventoryHeader />

      <SourcingCriteria />

      <VehicleGrid vehicles={vehicles} />

      <InventoryCta />
    </div>
  );
}
