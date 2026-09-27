import type { Metadata, Viewport } from "next";

import { inter, sora } from "@/app/fonts";
import { SITE_DESCRIPTION, SITE_NAME } from "@/config/site";
import "./globals.css";

/**
 * The document shell. Every route in this application renders inside it.
 *
 * ---------------------------------------------------------------------------
 * Why this file no longer renders the site header and footer
 * ---------------------------------------------------------------------------
 * Because it is no longer the *site* layout - it is the *document* layout, and
 * the admin surface is not part of the site. Keeping `<SiteHeader />` and
 * `<SiteFooter />` here would have put a marketing navigation bar, a footer of
 * links to pages that do not exist, and a floating WhatsApp button above every
 * page a staff member uses to edit inventory.
 *
 * Those three now render in `app/(marketing)/layout.tsx`, which is where they
 * belong: the public site. The route group is named for what it contains, and it
 * costs nothing in URLs - a group is omitted from the path, so `/inventory` is
 * still `/inventory`.
 *
 * The alternative was a second root layout via multiple root layouts, which Next
 * supports. It was rejected for two reasons, both of which show up later rather
 * than sooner: navigating between two root layouts forces a full page reload, and
 * each root layout has to repeat `<html>`, `<body>`, the font variables and the
 * global stylesheet. Duplicating the document setup in two files is exactly the
 * kind of thing that drifts - one root layout gets a font fix and the other does
 * not, and the difference is invisible until someone visits the other area.
 *
 * One root layout means one `<main>`, one skip link and one place the document
 * metadata is declared. The admin area gets its own chrome inside that `<main>`,
 * which is the part it actually needed.
 *
 * ---------------------------------------------------------------------------
 * Fonts
 * ---------------------------------------------------------------------------
 * Loaded from files committed to this repository via `next/font/local` - see
 * `app/fonts.ts` for why. The practical consequences: no third-party request at
 * build time or at runtime, no visitor IP is leaked to a font host, and the build
 * cannot fail because a CDN is down.
 *
 * `display: "swap"` paints fallback text immediately instead of blocking on the
 * font, and `adjustFontFallback` keeps that fallback metric-compatible so the swap
 * does not shift the layout.
 *
 * `variable` exposes each family as a CSS custom property, which `globals.css`
 * maps onto the `--font-sans` / `--font-display` theme tokens.
 */

/**
 * Title strategy: the root supplies an absolute default plus a template, so
 * every page renders "<page> | Humera Automobile" without repeating the brand.
 *
 * `SITE_NAME` comes from `config/site.ts` rather than being restated here, so the
 * brand name has exactly one definition in the project.
 */
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: `${SITE_NAME} | Vehicle Sales & Export, Dubai`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  robots: {
    // Step 1 is a technical foundation with no public content to index.
    // Switch to `index: true, follow: true` when real pages ship.
    index: false,
    follow: false,
    nocache: true,
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_AE",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#07090c" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-AE"
      // `data-scroll-behavior` restores smooth scrolling, which Next 16 no
      // longer applies automatically.
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${sora.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-page text-fg">
        {/*
          Skip link. First in the DOM and visually hidden until focused, so a
          keyboard user can jump past the header on every page instead of tabbing
          through it each time. The `focus` variant - not `focus-visible` -
          because a skip link has to appear for keyboard users, who are exactly
          the people `focus-visible` is unreliable for.

          It lives here rather than in the marketing layout because the admin area
          has its own navigation and needs the same escape from it.
        */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-sm focus:border focus:border-line-control focus:bg-raised focus:px-4 focus:py-2.5 focus:text-body-sm focus:font-semibold focus:text-fg focus:shadow-md"
        >
          Skip to main content
        </a>

        {/*
          The single `<main>` for the application. It lives here rather than in
          each page so a page can never ship a second one, and so `flex-1` pushes
          the footer to the bottom of the viewport on any page shorter than the
          window.

          `tabIndex={-1}` is required: without it, following the skip link moves
          the viewport but not keyboard focus, so the next Tab continues from the
          top of the document and the skip appears to have done nothing.

          The admin area renders its own header inside this `<main>` rather than
          beside it, which is the one compromise of keeping a single document
          layout. It is a good trade: the staff chrome is a bar at the top of the
          content, not site furniture that has to align with the footer.
        */}
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>
      </body>
    </html>
  );
}
