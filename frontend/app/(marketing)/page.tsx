import type { Metadata } from "next";

import { Hero } from "@/features/home/components/hero";
import { WelcomeSection } from "@/features/home/components/welcome-section";
import { ServiceHighlights } from "@/features/home/components/service-highlights";
import { toShowroomCars } from "@/features/home/lib/showroom-cars";
import { PLACEHOLDER_CARS } from "@/features/home/lib/placeholder-cars";
import { SITE_NAME } from "@/config/site";

/**
 * Homepage.
 *
 * The Step 1 technical placeholder ("Implemented" / "Not yet built") was
 * removed rather than kept below the fold. It was accurate when the site was a
 * foundation demo and is now a liability: a visitor does not need to be told
 * which features are unbuilt, and a build-status table under a conversion
 * section reads as a demo. The equivalent information lives in the repository
 * README, which is where a developer looks for it.
 *
 * ---------------------------------------------------------------------------
 * Metadata
 * ---------------------------------------------------------------------------
 * `description` reuses the project's canonical one-line description rather than
 * rewriting it, so there is only ever one authoritative statement of what the
 * business is.
 *
 * ---------------------------------------------------------------------------
 * Why the title is `absolute` and not a plain string
 * ---------------------------------------------------------------------------
 * Every other page inherits the root layout's `title.template` and renders
 * "<page> | Humera Automobile". The homepage silently did not: Next.js does not
 * apply a `template` to a `title` declared in a `page.js` that shares a route
 * segment with the layout defining it, and `app/layout.tsx` and `app/page.tsx`
 * are both segment `/`. A plain string here rendered as
 * "Vehicle Sales & Export, Dubai" - the brand dropped from the title of the most
 * important page on the site.
 *
 * `absolute` states the intent explicitly and opts out of the template rather
 * than working around it by coincidence. The value is composed with `SITE_NAME`
 * so the brand name still has exactly one definition in the project, and the
 * pattern matches every other route.
 */
export const metadata: Metadata = {
  title: {
    absolute: `Vehicle Sales & Export, Dubai | ${SITE_NAME}`,
  },
  description:
    "Humera Automobile is a Dubai-based vehicle sales and international export business. Ask us to source and export a vehicle for you.",
  // `/` is the canonical origin for the home page, and it prevents the footer and
  // header links from generating competing variants of the same page.
  alternates: { canonical: "/" },
  openGraph: {
    // Inherits description, siteName and locale from the root layout; only the
    // type and the URL are page-specific.
    url: "/",
  },
};

/**
 * The mapped cars, resolved once at module scope.
 *
 * `WelcomeSection` takes data as a prop and holds none, so the mapping is the
 * page's job. Doing it here rather than inside the section is what makes the
 * eventual swap to the real inventory a one-line change: replace
 * `toShowroomCars(PLACEHOLDER_CARS)` with `fromVehicles(vehicles, resolveType)`
 * and nothing in the section changes.
 *
 * Module scope rather than inside the component body because the result is a pure
 * function of a constant, and recomputing it on every render would be work whose
 * output never changes.
 */
const SHOWROOM_CARS = toShowroomCars(PLACEHOLDER_CARS);

export default function HomePage() {
  return (
    <>
      {/*
        The hero owns the page's only `h1`. Nothing below it may introduce
        another one - `WelcomeSection` and `ServiceHighlights` start at `h2`,
        so the outline is h1 > h2 > h3 with nothing skipped.
      */}
      <Hero />

      <WelcomeSection cars={SHOWROOM_CARS} />

      <ServiceHighlights />
    </>
  );
}
