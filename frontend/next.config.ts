import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Compile-time checking of `href` values passed to `next/link` and to the
   * `next/navigation` helpers. A mistyped route becomes a type error rather
   * than a 404 discovered by a customer.
   */
  typedRoutes: true,

  /**
   * Vehicle imagery will be served from a CDN. The allow-list is intentionally
   * empty in Step 1: add `remotePatterns` entries in the same commit that first
   * needs them, so the list never contains hosts the site does not use.
   */
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
