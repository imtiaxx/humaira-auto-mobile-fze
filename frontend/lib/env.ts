/**
 * Environment access.
 *
 * `NEXT_PUBLIC_*` variables are inlined into the client bundle at build time,
 * so every reference must be a static property access. Dynamic lookups such as
 * `process.env[name]` are **not** inlined and would resolve to `undefined` in
 * the browser - this module therefore spells each variable out explicitly.
 */

/** Variables safe to expose to the browser. */
const publicEnv = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
} as const;

/** Fails fast, with an actionable message, when a variable is missing. */
function required(value: string | undefined, name: string, fallback: string): string {
  const resolved = value?.trim() || fallback;
  return resolved.replace(/\/+$/, "");
}

export const env = {
  /** Base URL of the backend API, without a trailing slash. */
  apiUrl: required(publicEnv.apiUrl, "NEXT_PUBLIC_API_URL", "http://localhost:8000"),

  /** Public origin of this site, without a trailing slash. */
  siteUrl: required(publicEnv.siteUrl, "NEXT_PUBLIC_SITE_URL", "http://localhost:3000"),

  /** True when pointing at a local backend. */
  isLocalApi: (process.env.NODE_ENV ?? "development") !== "production",
} as const;
