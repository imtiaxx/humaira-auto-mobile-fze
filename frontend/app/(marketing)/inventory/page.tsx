import type { Metadata } from "next";

import { InventoryCta } from "@/features/vehicles/components/inventory-cta";
import { InventoryFilters } from "@/features/vehicles/components/inventory-filters";
import { InventoryHeader } from "@/features/vehicles/components/inventory-header";
import { VehicleGrid } from "@/features/vehicles/components/vehicle-grid";
import { toVehicleFacets } from "@/features/vehicles/lib/facets";
import { FILTER_KEYS, parseVehicleFilters } from "@/features/vehicles/lib/filters";
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

export default async function InventoryPage({
  searchParams,
}: {
  /**
   * Next 16: `searchParams` is a Promise, and the type is a plain record rather
   * than `URLSearchParams`. Both matter. The Promise has to be awaited, and a
   * value can be `string[]` when a key is repeated - which is why
   * `parseVehicleFilters` accepts this shape instead of only `URLSearchParams`.
   */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  /*
    The filter bar submits with `method="get"`, so the query string is the state
    of this page: there is no client-side filter state anywhere. That is what makes
    the control set work without JavaScript and makes a filtered inventory a
    shareable address, and it is why this is the only place the URL is read.
  */
  const { filters, errors, active } = parseVehicleFilters(params);

  /*
    The results are narrowed by the *server*. `listVehicles(filters)` sends the
    filter to the API rather than filtering the returned array, so the count shown
    is a count of what the backend matched and the grid cannot show a car the
    server excluded.
  */
  const vehicles = await listVehicles(filters);

  /*
    The facet options come from the unfiltered inventory, not the filtered one.

    Options filtered by the current selection would be self-defeating: choosing
    "Diesel" would remove every other fuel from the dropdown, so the visitor could
    not widen the search from the control they used to narrow it. Real faceted
    search derives the option lists from the whole result set for exactly this
    reason.

    It costs a second read, and only when a filter is active - the unfiltered
    request already holds every vehicle, so `vehicles` *is* the whole inventory
    then. That is the same trade `getVehicleBySlug` documents: an extra read is
    cheaper than a control that cannot undo itself. A dedicated facets endpoint is
    the answer if this ever dominates, and it is the reason this is written as one
    call rather than three.
  */
  const published = active ? await listVehicles() : vehicles;
  const facets = toVehicleFacets(published);

  /*
    The raw submitted strings, re-read from the URL rather than from `filters`.
    `filters` has already dropped any value the parser rejected, so rendering the
    form from it would blank the field that carries the error message beside it -
    the visitor would be told their year was invalid and shown an empty box. The
    URL still holds what they typed, which is the whole point of submitting a form
    with GET.
  */
  const values: Record<string, string | undefined> = {};
  for (const key of FILTER_KEYS) {
    const raw = params[key];
    const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
    if (typeof value === "string" && value.trim() !== "") values[key] = value;
  }

  return (
    /*
      `bg-page` is the near-black canvas, and it is all this wrapper needs.

      This used to be `on-inverse`, which re-pointed the semantic tokens so that
      every `bg-page` / `text-fg` / `border-line` beneath it resolved to their
      deep values. The black + red + white re-theme moved that canvas from an
      opt-in scope to the default, so the scope was removed and the same
      components now read as one near-black marketplace without a single colour
      class changing. The sections below were already written against the token
      layer, which is the whole reason this page needed no edits.

      The header and footer live in the marketing layout, outside this wrapper,
      so they keep the treatment they have on every other public page.
    */
    <div className="bg-page">
      {/*
        `InventoryHeader` owns the page's only `h1`. Every section below it
        starts at `h2`, so the outline is h1 > h2 with nothing skipped.

        Section order follows the brief and, more importantly, the order a
        visitor needs it in: orient, narrow, see what matched, then act. The
        conversion panel is last because it is the answer to everything above it -
        and specifically the answer to a filter that matched nothing, which is
        why the sourcing story survives the arrival of real filters.
      */}
      <InventoryHeader />

      <InventoryFilters
        facets={facets}
        values={values}
        errors={errors}
        resultCount={vehicles.length}
        publishedCount={published.length}
        active={active}
      />

      <VehicleGrid vehicles={vehicles} filtered={active} filters={filters} />

      <InventoryCta />
    </div>
  );
}
