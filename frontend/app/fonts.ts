import localFont from "next/font/local";

/**
 * Self-hosted variable fonts.
 *
 * Why these files are committed rather than fetched from a font CDN at build
 * time: a design system has to render identically on a laptop, in CI, and in a
 * restricted network. If the font host is unreachable, a build that depends on
 * it either fails outright or silently ships fallback metrics, which produces
 * layout shift nobody notices until it is in production. `next/font/local`
 * removes the network dependency from both the build and the browser - the
 * WOFF2 files are hashed, fingerprinted, served from this origin, and cached
 * forever.
 *
 * Licence: SIL Open Font License 1.1. See `fonts/OFL.txt`.
 *
 * Both families are variable, so one file per subset covers every weight the
 * design system uses (400-700). Subsetting is limited to `latin` and
 * `latin-ext`, which is all an English-language site with `en-AE` needs; adding
 * a script means adding the file and the `unicode-range` entry here.
 */

/**
 * Metric-adjusted fallbacks. `adjustFontFallback` asks the browser to shrink or
 * grow the fallback face to match the webfont's metrics, so swapping to
 * system-ui on a slow connection does not reflow the page.
 */
export const inter = localFont({
  src: [
    { path: "../fonts/inter-latin.woff2", weight: "400 700", style: "normal" },
    { path: "../fonts/inter-latin-ext.woff2", weight: "400 700", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  adjustFontFallback: "Arial",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

/**
 * Display face. Used only for headings and large numerals; body copy stays on
 * Inter, because Sora's wide geometric forms are tiring at paragraph length.
 */
export const sora = localFont({
  src: [
    { path: "../fonts/sora-latin.woff2", weight: "400 700", style: "normal" },
    { path: "../fonts/sora-latin-ext.woff2", weight: "400 700", style: "normal" },
  ],
  variable: "--font-sora",
  display: "swap",
  adjustFontFallback: "Arial",
  fallback: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});
