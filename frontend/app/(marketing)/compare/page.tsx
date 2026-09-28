import type { Metadata } from "next";

import { VehicleComparison } from "@/features/vehicles/components/vehicle-comparison";
import { parseComparison, resolveComparison } from "@/features/vehicles/lib/compare";
import { listVehicles } from "@/features/vehicles/lib/inventory";
import { SITE_NAME } from "@/config/site";

/**
 * The /compare page.
 *
 * ---------------------------------------------------------------------------
 * Why the route is `/compare`
 * ---------------------------------------------------------------------------
 * Because `navigation/config.ts` already says so, and because
 * `navigation/active.test.ts` asserts `/compare` and fails on `/compare-cars`.
 * Both were written before this route existed - the nav config as a declaration
 * of intent, the test as the thing that would catch a route landing on the wrong
 * address. Inventing `/compare-cars` because it reads better would have broken a
 * test that was written specifically to prevent that, and splitting navigation
 * and routing across two names for one page is the failure the config's own
 * documentation warns about for `/inventory` versus `/vehicles`.
 *
 * ---------------------------------------------------------------------------
 * Why this is a Server Component reading the URL, like /inventory
 * ---------------------------------------------------------------------------
 * The picker submits with `method="get"`, so the query string is the state of
 * this page: there is no client-side comparison state anywhere, and the page
 * renders with JavaScript disabled. A comparison the visitor cannot bookmark,
 * share or reopen on a second device would not be worth building, and the whole
 * feature is that `/compare?vehicles=a&vehicles=b` is a real address from the
 * first render.
 *
 * Next 16: `searchParams` is a Promise and a repeated key arrives as a
 * `string[]`, which is exactly why `parseComparison` accepts that record shape
 * as well as `URLSearchParams`.
 *
 * ---------------------------------------------------------------------------
 * Why one read, and not one read per vehicle
 * ---------------------------------------------------------------------------
 * `getVehicleBySlug` would be the obvious way to resolve each slug - and it is
 * wrong here, because each call performs its own `listVehicles()` request.
 * Comparing four vehicles would then cost five API round trips to produce a
 * table built from a list this page is fetching anyway.
 *
 * So `listVehicles()` is called exactly once and `resolveComparison` does the
 * matching in memory. This is the same seam `brands.ts` documents for grouping
 * a list the page already has, and it is why the module takes an array instead
 * of fetching: the matching logic stays pure and unit-tested, and the page owns
 * the I/O.
 *
 * One read also means the table and the picker cannot disagree. A vehicle
 * published between two requests would appear in the picker's list and not in
 * the catalogue the table was resolved against; `catalogue` is passed to both from
 * this single read for exactly that reason.
 *
 * ---------------------------------------------------------------------------
 * No auth, and nothing to protect
 * ---------------------------------------------------------------------------
 * `/compare` is a public marketing route under the same layout as `/inventory`
 * and `/brands`, so it is not behind the staff proxy guard in `proxy.ts` and
 * needs no session. The only data it can reach is what `listVehicles()` returns,
 * which is the published inventory - a public GET. There is no draft vehicle to
 * leak, and no query parameter that widens the read beyond the public list.
 *
 * Metadata follows the `/inventory` page: a plain `title` string so the root
 * layout's `title.template` applies, no `robots` (the site-wide directive is
 * declared once in the root layout, and repeating it here would create a second
 * place to forget), and `openGraph` written out in full because Next merges
 * metadata shallowly and a one-line `openGraph: { url }` would drop `og:type`,
 * `og:site_name` and `og:locale`.
 */
export const metadata: Metadata = {
  title: "Compare vehicles",
  description:
    "Put up to four vehicles from Humera Automobile's published stock side by side and compare price, year, mileage, body type, fuel, transmission, colour and availability.",
  alternates: { canonical: "/compare" },
  openGraph: {
    url: "/compare",
    // Restated rather than inherited - see the note above on shallow merging.
    type: "website",
    siteName: SITE_NAME,
    locale: "en_AE",
  },
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  /*
    The selection is read before the catalogue so a malformed address is refused
    before it can reach the resolution step. Parsing cannot throw: every value is
    a string, and every string either normalises, fails the pattern, or is a
    duplicate.
  */
  const { slugs, malformed, overLimit } = parseComparison(params);

  /*
    The one and only API read for this page. `listVehicles()` takes no filters,
    so this is the full published inventory - the same array resolves the
    selection *and* populates the picker.
  */
  const catalogue = await listVehicles();

  const { vehicles, unmatched, overflow } = resolveComparison(catalogue, slugs);

  /*
    Overflow is reported as one number from two sources, and that is deliberate.
    `overLimit.length` counts values dropped at parse time for being past the cap
    - which may not be real vehicles at all. `overflow` counts real, published
    vehicles that matched but had no room. A visitor who ticked six cares that two
    were left out, not whether the sixth was a car we actually hold, so the two
    are added and the distinction stays inside `compare.ts`, where the tests for
    each are.
  */
  return (
    /*
      `on-inverse` opens the deep palette for the whole page, exactly as
      `/inventory` does. The header and footer live in the marketing layout
      outside this wrapper and keep the treatment they have everywhere else.
    */
    <div className="on-inverse bg-page">
      <VehicleComparison
        vehicles={vehicles}
        catalogue={catalogue}
        unmatched={unmatched}
        overflow={overflow + overLimit.length}
        malformedCount={malformed.length}
      />
    </div>
  );
}
