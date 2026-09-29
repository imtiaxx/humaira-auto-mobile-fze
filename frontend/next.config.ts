import type { NextConfig } from "next";

/**
 * Where the backend serves vehicle photographs from.
 *
 * Read from `NEXT_PUBLIC_API_URL` for the same reason the rest of the app reads it:
 * one variable, set once per environment, describes the API's origin. A second
 * variable for the image host would be a second thing to forget to set, and the
 * failure mode - every photograph 400ing at the optimiser - is confusing rather
 * than obvious.
 *
 * The backend builds each `src` from this origin, or from its own
 * `image_public_base_url` when a deployment serves the media from a CDN instead. A
 * CDN origin therefore also has to be allowed below; see the note on
 * `remotePatterns`.
 */
const apiOrigin = process.env.NEXT_PUBLIC_API_URL;

/**
 * The image allow-list.
 *
 * ---------------------------------------------------------------------------
 * Why this cannot be a bare host
 * ---------------------------------------------------------------------------
 * Because `next/image` fetches the source from *its own server*, so a `src` of
 * `https://api.example.com/media/…` is a request from the app's server, not from
 * the browser. Allowing arbitrary hosts would make this server a proxy for whatever
 * a response body put in an image `src` - the classic SSRF-via-image-optimizer. So
 * the pattern is `protocol` + `hostname` + `port`, not a substring.
 *
 * ---------------------------------------------------------------------------
 * Why the port is pinned, and what pinning it actually does
 * ---------------------------------------------------------------------------
 * Next's own matcher (`shared/lib/match-remote-pattern.js`) compares the port with
 * `if (pattern.port !== undefined) { if (pattern.port !== url.port) return false }`.
 * Three consequences, and the third is the one that is easy to get backwards:
 *
 *   - `port` **present** -> an exact match on that port. `url.port` is `""` for a
 *     standard origin, so `port: url.port` below means "no port" for
 *     `https://api.example.com` and "port 8000" for `http://localhost:8000`. The
 *     same line is correct in both environments, with no branching on whether the
 *     variable happens to include a port.
 *   - `port: ""` -> only URLs that carry no explicit port. This is what Next's own
 *     docs use to *block* custom ports, and it would break every local
 *     development build, where the API is on :8000 and this app is on :3000.
 *   - `port` **omitted** -> no port constraint at all, so *any* port on that
 *     hostname is fetched and optimised by this server. Next's docs call this out
 *     explicitly: "When omitting protocol, port, pathname, or search then the
 *     wildcard `**` is implied. This is not recommended because it may allow
 *     malicious actors to optimize urls you did not intend."
 *
 * An earlier version of this file omitted the port, on the reasoning that an empty
 * string was rejected. It is not; the empty string is meaningful, and omitting it
 * is the option that is actually permissive.
 */
function remotePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];

  // Backend API images (from NEXT_PUBLIC_API_URL)
  if (apiOrigin !== undefined && apiOrigin !== "") {
    const url = new URL(apiOrigin);
    patterns.push({
      protocol: url.protocol.replace(":", "") as "http" | "https",
      hostname: url.hostname,
      port: url.port,
      // The backend mounts stored images under `/media`; nothing else on the API
      // origin is an image, and narrowing the path keeps a misconfigured
      // `src` elsewhere on the same host from being fetched and optimised.
      pathname: "/media/**",
    });
  }

  // Unsplash placeholder images for welcome section (development only)
  patterns.push({
    protocol: "https",
    hostname: "images.unsplash.com",
    pathname: "/**",
  });

  return patterns;
}

/**
 * Whether the configured API origin is this machine's own loopback interface.
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 * ---------------------------------------------------------------------------
 * Next's image optimiser refuses, by default, to fetch an image whose hostname
 * resolves to a private or loopback address. That guard is the SSRF protection:
 * without it, a `src` naming `http://169.254.169.254/...` would turn this server
 * into a proxy for whatever else answers on the private network.
 *
 * The difficulty is that in local development the image origin *is* loopback -
 * `NEXT_PUBLIC_API_URL` is `http://localhost:8000` - so the guard refuses the
 * application's own vehicle photographs and every `next/image` on the site
 * renders as a broken image with a `400 "url" parameter is not allowed` from
 * `/_next/image`. Enabling the option unconditionally would fix that and remove
 * the protection in production, which is where it matters.
 *
 * So it is derived from the same variable that decides the allow-list, and only
 * when that origin is a literal loopback address. A production
 * `https://api.example.com` leaves it `false` and the guard fully intact; a
 * local `http://localhost:8000` sets it `true` so the photographs appear.
 *
 * The loopback hosts are listed literally rather than being "any private range":
 * a literal match cannot be widened by a DNS entry, and a hostname like
 * `192.168.1.11` on the LAN deliberately does *not* qualify - a machine on the
 * office network is not this application, and its images are not this
 * application's to fetch.
 */
function apiIsLoopback(): boolean {
  if (apiOrigin === undefined || apiOrigin === "") return false;
  try {
    const { hostname } = new URL(apiOrigin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    // A malformed variable must not silently disable the SSRF guard; the build
    // error from `remotePatterns()` is the honest failure.
    return false;
  }
}

const nextConfig: NextConfig = {
  /**
   * Compile-time checking of `href` values passed to `next/link` and to the
   * `next/navigation` helpers. A mistyped route becomes a type error rather than
   * a 404 discovered by a customer.
   */
  typedRoutes: true,

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: remotePatterns(),
    dangerouslyAllowLocalIP: apiIsLoopback(),
  },
};

export default nextConfig;
