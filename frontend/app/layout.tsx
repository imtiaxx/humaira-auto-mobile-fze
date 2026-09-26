import type { Metadata, Viewport } from "next";

import { inter, sora } from "@/app/fonts";
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

const SITE_NAME = "Humera Automobile";
const SITE_DESCRIPTION =
  "Humera Automobile is a Dubai-based vehicle sales and international export business.";

/**
 * Title strategy: the root supplies an absolute default plus a template, so
 * every page renders "<page> | Humera Automobile" without repeating the brand.
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
      <body className="flex min-h-full flex-col bg-page text-fg">{children}</body>
    </html>
  );
}
