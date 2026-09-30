import type { Metadata } from "next";

import { AboutPageBody } from "@/features/vehicles/components/about-page";
import { SITE_NAME } from "@/config/site";

/**
 * The About page.
 *
 * ---------------------------------------------------------------------------
 * Why this route is `/about`
 * ---------------------------------------------------------------------------
 * The navigation config decides, and this page follows it rather than introducing
 * a second URL for the same content. `navigation/config.ts` has declared
 * `label: "About"` with `path: "/about"` in both the primary nav and the footer's
 * Company group since the information architecture was written.
 *
 * ---------------------------------------------------------------------------
 * What landing here changed in `navigation/config.ts`
 * ---------------------------------------------------------------------------
 * The two `About` entries were promoted from `status: "planned"` to `status: "live"`
 * - the two-word change that file's documentation describes. `path` became `href`,
 * and because `href` is typed as Next's `Route`, the compiler verified this route
 * exists as part of the same change that promoted it. A mistyped path fails the
 * build rather than shipping a 404.
 *
 * That promotion is the mechanism by which a planned navigation entry becomes a
 * feature. It is how `Inventory`, `Brands`, `Compare` and `Sell / Source` were
 * done, and it is why no stub page and no dead link was ever needed.
 *
 * ---------------------------------------------------------------------------
 * Why the page has no logic
 * ---------------------------------------------------------------------------
 * Nothing here fetches, filters or holds state - the page is static copy and two
 * links to routes that already exist. `docs/architecture.md` reserves `app/` for
 * routes with no business logic, and there is nothing to move.
 *
 * ---------------------------------------------------------------------------
 * Metadata, following the conventions already set
 * ---------------------------------------------------------------------------
 * `title` is a plain string, so the root layout's `title.template` applies and
 * this renders as "About | Humera Automobile". The homepage is the only page
 * needing `title.absolute`, because it shares the `/` segment with the layout
 * defining the template.
 *
 * `robots` is deliberately not set, for the same reason as on `/brands` and
 * `/sell`: the root layout already declares the whole site `index: false,
 * follow: false` while it has no public content, and repeating it per page would
 * duplicate a global decision and create a second place to forget to change it
 * when the site does become indexable.
 *
 * `openGraph` is restated in full rather than written as `openGraph: { url }`,
 * because Next merges segment metadata shallowly - a page-level `openGraph`
 * *replaces* the root layout's object wholesale, so the one-liner would silently
 * drop `og:type`, `og:site_name` and `og:locale` from the rendered tags.
 *
 * The description makes no claim that could be disproved: no founding year, no
 * volume, no accreditation. It says what the business is and what the page covers,
 * both of which are established in `config/site.ts`.
 */
export const metadata: Metadata = {
  title: "About",
  description:
    "About Humera Automobile: a Dubai-based vehicle sales and international export business. Our approach, the services we offer, and what we hold ourselves to.",
  alternates: { canonical: "/about" },
  openGraph: {
    url: "/about",
    // Restated rather than inherited - see the note above on shallow merging.
    type: "website",
    siteName: SITE_NAME,
    locale: "en_AE",
  },
};

export default function AboutPage() {
  return <AboutPageBody />;
}
