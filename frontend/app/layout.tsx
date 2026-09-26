import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";

import "./globals.css";

/**
 * Fonts are self-hosted by `next/font`, which removes the render-blocking
 * request to Google and eliminates the privacy leak of sending every visitor's
 * IP to a third party. `display: "swap"` shows fallback metrics-compatible text
 * immediately instead of a blank block.
 *
 * `variable` exposes each family as a CSS custom property, which
 * `globals.css` maps onto the `--font-sans` / `--font-display` theme tokens.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sora",
});

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
