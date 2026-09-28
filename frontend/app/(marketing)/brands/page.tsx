import type { Metadata } from "next";

import { BrandDirectory } from "@/features/vehicles/components/brand-directory";
import { toBrandDirectory } from "@/features/vehicles/lib/brands";
import { listVehicles } from "@/features/vehicles/lib/inventory";
import { SITE_NAME } from "@/config/site";

/**
 * The brands page.
 *
 * ---------------------------------------------------------------------------
 * Why this route is `/brands` and not `/makes`
 * ---------------------------------------------------------------------------
 * The navigation config decides this, and this page follows it rather than
 * introducing a second URL for the same content. `navigation/config.ts` declares
 * `label: "Brands"` with `path: "/brands"` in the primary nav and an identical
 * entry in the footer, and `docs/architecture.md` states that the route follows
 * the config. "Brands" is what the site calls them, so the address is
 * `/brands`; a `/makes` alias would create two addresses for one page, split the
 * navigation's own vocabulary, and leave the two disagreeing.
 *
 * When this page landed, the two `Brands` items in that config were promoted
 * from `status: "planned"` to `status: "live"` - the one-word change the file's
 * own documentation describes, and which the compiler immediately checks against
 * the real route. That promotion is the whole mechanism by which a planned
 * navigation entry becomes a feature; it is how `Inventory` was done too.
 *
 * ---------------------------------------------------------------------------
 * Why the page is this small
 * ---------------------------------------------------------------------------
 * Three lines of logic: read the published inventory, group it by make, hand the
 * result to the component. That is deliberate. The page adds no fetching of its
 * own, no state, no filter handling and no query string - it is the simplest
 * possible consumer of `listVehicles()` and `toBrandDirectory()`, so the shape of
 * the data and the shape of the page can be read in one screen.
 *
 * `listVehicles()` is called with no arguments, so this is the unfiltered,
 * published, non-archived set - the same default `/inventory` uses when no filter
 * is active. It is the right input for a directory: filtering it would make
 * brands appear and disappear according to a query string nobody linked to.
 *
 * ---------------------------------------------------------------------------
 * Metadata, following the conventions already set
 * ---------------------------------------------------------------------------
 * `title` is a plain string, so the root layout's `title.template` applies and
 * this renders as "Brands | Humera Automobile". The homepage is the only page
 * that needs `title.absolute`, because it shares the `/` segment with the layout
 * defining the template; this page does not.
 *
 * `robots` is deliberately not set. The root layout already declares the whole
 * site `index: false, follow: false` while it has no public content, and
 * repeating the directive per page would duplicate a global decision and create
 * a second place to forget to change it when the site does become indexable.
 *
 * `openGraph` is restated in full rather than written as `openGraph: { url }`,
 * because Next merges segment metadata shallowly: a page-level `openGraph`
 * *replaces* the root layout's object wholesale, so the one-liner would silently
 * drop `og:type`, `og:site_name` and `og:locale` from the rendered tags. This is
 * the inventory page's reasoning, and the same values come from the same
 * `SITE_NAME` and the same locale, so each still has exactly one definition.
 *
 * ---------------------------------------------------------------------------
 * The description, and what it deliberately does not say
 * ---------------------------------------------------------------------------
 * It names Dubai and the business from `config/site.ts`, and describes what the
 * page is. It does not name a make, quote a vehicle count, or promise a price
 * range, because metadata is written by hand and goes stale the moment a vehicle
 * is published or archived - while the page body is derived from the inventory
 * and is correct the moment it renders. A search result promising "13 vehicles"
 * for a catalogue that holds 12 by tomorrow is the exact failure the derivation
 * avoids everywhere else, so the description stays true without maintenance.
 */
export const metadata: Metadata = {
  title: "Brands",
  description:
    "Browse the makes Humera Automobile currently has vehicles listed for in Dubai, with the models in stock and published price ranges. Open a make to see its vehicles, or ask us to source any make, model, year and budget.",
  alternates: { canonical: "/brands" },
  openGraph: {
    url: "/brands",
    // Restated rather than inherited - see the note above on shallow merging.
    type: "website",
    siteName: SITE_NAME,
    locale: "en_AE",
  },
};

export default async function BrandsPage() {
  /*
    The published inventory, unfiltered. Grouping happens in the feature module
    rather than here: the page is routing, and `docs/architecture.md` reserves
    `app/` for routes with no business logic. The grouping is a domain concern
    that belongs beside the facets that already do the same job.
  */
  const vehicles = await listVehicles();
  const brands = toBrandDirectory(vehicles);

  return <BrandDirectory brands={brands} />;
}
