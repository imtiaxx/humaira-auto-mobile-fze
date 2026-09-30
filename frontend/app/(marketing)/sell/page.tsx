import type { Metadata } from "next";

import { SellSource } from "@/features/vehicles/components/sell-source";
import { SITE_NAME } from "@/config/site";

/**
 * The Sell / Source page.
 *
 * ---------------------------------------------------------------------------
 * Why this route is `/sell` and not `/sell-your-car`
 * ---------------------------------------------------------------------------
 * The navigation config decides, and this page follows it rather than introducing
 * a second URL for the same content. `navigation/config.ts` has declared
 * `label: "Sell / Source"` with `path: "/sell"` since the information architecture
 * was written, and `docs/architecture.md` states that routes follow the config.
 *
 * `navigation/active.ts` reasons about the same path in its own examples, so the
 * active-state logic was already written expecting this URL. A `/sell-your-car`
 * alias would create two addresses for one page and leave the nav's own active
 * check disagreeing with the address bar.
 *
 * ---------------------------------------------------------------------------
 * What landing here changed in `navigation/config.ts`
 * ---------------------------------------------------------------------------
 * The two `Sell / Source` entries - the primary nav item and the footer item -
 * were promoted from `status: "planned"` to `status: "live"`, which is the
 * two-word change that file's documentation describes. `path` became `href`, and
 * because `href` is typed as Next's `Route`, the compiler verified this route
 * exists as part of the same change that promoted it. If the path were mistyped,
 * this page would not build.
 *
 * That promotion is the whole mechanism by which a planned navigation entry
 * becomes a feature. It is how `Inventory`, `Brands` and `Compare` were done, and
 * it is why no stub page and no dead link was ever needed.
 *
 * ---------------------------------------------------------------------------
 * Why the page has no logic at all
 * ---------------------------------------------------------------------------
 * Nothing here fetches, filters or holds state. The services are static copy and
 * the two calls to action are environment-configured links, so the page is pure
 * routing plus one component - the simplest possible consumer of `SellSource`.
 * `docs/architecture.md` reserves `app/` for routes with no business logic, and
 * there is no logic to move.
 *
 * ---------------------------------------------------------------------------
 * Metadata, following the conventions already set
 * ---------------------------------------------------------------------------
 * `title` is a plain string, so the root layout's `title.template` applies and
 * this renders as "Sell / Source | Humera Automobile". The homepage is the only
 * page needing `title.absolute`, because it shares the `/` segment with the layout
 * defining the template; this page does not.
 *
 * `robots` is deliberately not set, for the same reason as on `/brands`: the root
 * layout already declares the whole site `index: false, follow: false` while it
 * has no public content, and repeating it per page would duplicate a global
 * decision and create a second place to forget.
 *
 * `openGraph` is restated in full rather than written as `openGraph: { url }`,
 * because Next merges segment metadata shallowly - a page-level `openGraph`
 * *replaces* the root layout's object wholesale, so the one-liner would silently
 * drop `og:type`, `og:site_name` and `og:locale` from the rendered tags.
 *
 * The description names both services and neither makes a promise that could go
 * stale: no turnaround time, no fee, no valuation figure, no vehicle count.
 */
export const metadata: Metadata = {
  title: "Sell / Source",
  description:
    "Sell your vehicle through Humera Automobile in Dubai, or ask us to source a specific make, model, year and budget. Share your details and our team will review your request.",
  alternates: { canonical: "/sell" },
  openGraph: {
    url: "/sell",
    // Restated rather than inherited - see the note above on shallow merging.
    type: "website",
    siteName: SITE_NAME,
    locale: "en_AE",
  },
};

export default function SellPage() {
  return <SellSource />;
}
