import type { Metadata, Viewport } from "next";

import { inter, sora } from "@/app/fonts";
import { WhatsAppFloat } from "@/components/cta/whatsapp-cta";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SITE_DESCRIPTION, SITE_NAME } from "@/config/site";
import "./globals.css";

/**
 * Fonts are loaded from files committed to this repository via
 * `next/font/local` - see `app/fonts.ts` for why. The practical consequences:
 * no third-party request at build time or at runtime, no visitor IP is leaked
 * to a font host, and the build cannot fail because a CDN is down.
 *
 * `display: "swap"` paints fallback text immediately instead of blocking on
 * the font, and `adjustFontFallback` keeps that fallback metric-compatible so
 * the swap does not shift the layout.
 *
 * `variable` exposes each family as a CSS custom property, which `globals.css`
 * maps onto the `--font-sans` / `--font-display` theme tokens.
 */

/**
 * Title strategy: the root supplies an absolute default plus a template, so
 * every page renders "<page> | Humera Automobile" without repeating the brand.
 *
 * `SITE_NAME` comes from `config/site.ts` rather than being restated here, so
 * the brand name has exactly one definition in the project.
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
          keyboard user can jump past the header's eight navigation items on
          every page instead of tabbing through them each time. The `focus`
          variant - not `focus-visible` - because a skip link has to appear for
          keyboard users, who are exactly the people `focus-visible` is
          unreliable for.
        */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-sm focus:border focus:border-line-control focus:bg-raised focus:px-4 focus:py-2.5 focus:text-body-sm focus:font-semibold focus:text-fg focus:shadow-md"
        >
          Skip to main content
        </a>

        <SiteHeader />

        {/*
          The single `<main>` for the site. It lives here rather than in each page
          so a page can never ship a second one, and so `flex-1` pushes the footer
          to the bottom of the viewport on any page shorter than the window.

          `id` is the skip link's target. `tabIndex={-1}` is required: without
          it, following the skip link moves the viewport but not keyboard focus,
          so the next Tab continues from the top of the document and the skip
          appears to have done nothing.
        */}
        <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
          {children}
        </main>

        <SiteFooter />

        {/*
          Floating contact action. Renders nothing until a WhatsApp number is
          configured, so it costs no DOM today.
        */}
        <WhatsAppFloat />
      </body>
    </html>
  );
}
