import type { Metadata } from "next";

import { Hero } from "@/features/home/components/hero";
import { ServiceHighlights } from "@/features/home/components/service-highlights";
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

export default function HomePage() {
  return (
    <>
      {/*
        The hero owns the page's only `h1`. Nothing below it may introduce
        another one - `ServiceHighlights` starts at `h2`, so the outline is
        h1 > h2 > h3 with nothing skipped.
      */}
      <Hero />

      <ServiceHighlights />
    </>
  );
}
