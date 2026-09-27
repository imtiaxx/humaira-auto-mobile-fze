/**
 * HTTP client for the Humera Automobile API.
 *
 * One place that knows how to talk to the backend: base URL, timeout, JSON
 * handling, correlation IDs and error normalisation. Feature code calls typed
 * wrappers in `./health.ts` (and future modules) and never touches `fetch`
 * directly, which keeps the transport swappable and the error contract uniform.
 *
 * Server Components and Server Actions only. The client deliberately contains
 * no `"use client"` directive: data fetching happens on the server so API
 * secrets and the database stay out of the browser. Interactive features that
 * need client-side calls will go through a Route Handler rather than widening
 * this module's surface.
 *
 * ---------------------------------------------------------------------------
 * Writes go through `apiSend`, not `fetch`
 * ---------------------------------------------------------------------------
 * The admin surface was added second and needed POST/PATCH/PUT/DELETE. Rather
 * than let a second, slightly different copy of the timeout and error handling
 * appear, both verbs share one `request()` core. The reason this matters is
 * specific: `apiGet` is used by public pages, where a `401` is a bug to
 * investigate, and by server actions, where a `422` is user input being
 * reported back. If the write path had its own transport, a bug fixed in one
 * would sit unfixed in the other indefinitely.
 */

import { cookies } from "next/headers";

import { env } from "@/lib/env";
import { ApiError, isApiErrorEnvelope } from "@/lib/api/errors";
import { STAFF_SESSION_COOKIE } from "@/lib/staff/session-cookie";

/** Matches the backend's `API_V1_PREFIX`. */
const API_PREFIX = "/api/v1";

/** Requests that outlive this are almost certainly a stuck connection. */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Uploads are allowed to be slower than reads.
 *
 * A vehicle photo is up to 10 MB on the wire, the backend re-encodes every one
 * it accepts, and up to ten may travel in a single request. Ten seconds is
 * generous for a database read and not generous at all for that, so a timeout
 * raised here would surface to staff as a failed upload of files that are in
 * fact fine - and, worse, an upload whose bytes arrived but whose confirmation
 * did not is the shape of bug that produces duplicate photographs.
 */
export const UPLOAD_TIMEOUT_MS = 120_000;

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** JSON-serialisable request body. Mutually exclusive with `form`. */
  json?: unknown;
  /**
   * Multipart body, for the image upload route.
   *
   * `fetch` sets the `Content-Type` boundary itself when given a `FormData`, and
   * it *must* be left unset: a hand-written `multipart/form-data` header without
   * the generated boundary produces a body the backend cannot parse, and the
   * resulting 422 blames the file rather than the header.
   */
  form?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
  /** Forwarded as `X-Request-ID` so a frontend trace can be matched to a log. */
  requestId?: string;
  /**
   * Whether to forward the staff session cookie to the API.
   *
   * Explicit rather than automatic, because "always send the cookie" would mean
   * the public inventory pages shipped a credential to every read for no reason.
   * Only the admin bindings opt in, and the choice is then visible at each call
   * site instead of being a property of the transport.
   */
  session?: "forward" | "omit";
}

/** Builds a query string, dropping empty values so URLs stay readable. */
function buildQuery(
  query: RequestOptions["query"],
): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const serialised = params.toString();
  return serialised ? `?${serialised}` : "";
}

function buildUrl(path: string, query: RequestOptions["query"]): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  const withPrefix = normalised.startsWith(API_PREFIX)
    ? normalised
    : `${API_PREFIX}${normalised}`;
  return `${env.apiUrl}${withPrefix}${buildQuery(query)}`;
}

/** Reads the backend's error envelope, falling back to the raw status text. */
async function toApiError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get("X-Request-ID") ?? undefined;
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (isApiErrorEnvelope(body)) {
    return new ApiError({
      kind: "http",
      status: response.status,
      code: body.error.code,
      requestId: body.error.request_id ?? requestId,
      message: body.error.message,
    });
  }

  return new ApiError({
    kind: "http",
    status: response.status,
    requestId,
    message: `Request failed with status ${response.status}.`,
  });
}

/**
 * Reads the staff session cookie from the *incoming* request so it can be
 * replayed to the API.
 *
 * The cookie is set on this application's origin by the login server action,
 * not by the backend, because the backend is a different origin: a cookie set
 * on `localhost:8000` is simply not sent to `localhost:3000`. Forwarding it by
 * hand is what makes the admin surface work across two origins without ever
 * putting the token in browser JavaScript.
 *
 * Returns `undefined` when there is no session, which is a normal state and not
 * an error - the API then answers `401`, and the caller decides what that means.
 */
async function sessionCookieHeader(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(STAFF_SESSION_COOKIE)?.value;
}

/**
 * Performs a request against the API and returns the decoded JSON body.
 *
 * One core for every verb. `apiGet` and `apiSend` below are thin wrappers over
 * it so that timeout handling, error normalisation and correlation IDs cannot
 * drift apart between reads and writes.
 *
 * @typeParam T - Shape the caller expects. This is an assertion, not a check;
 * validate untrusted payloads at the boundary when endpoints accept input.
 */
async function request<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    json,
    form,
    query,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    requestId,
    session = "omit",
    ...init
  } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);

  // Allow the caller to cancel without losing the distinction from a timeout.
  const onExternalAbort = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener("abort", onExternalAbort, { once: true });

  const sessionToken = session === "forward" ? await sessionCookieHeader() : undefined;

  // A `FormData` body must not carry an explicit Content-Type: `fetch` appends
  // the multipart boundary itself, and any header we set here would replace the
  // one it generates. Only the JSON branch sets one.
  const body = form ?? (json === undefined ? undefined : JSON.stringify(json));
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(requestId ? { "X-Request-ID": requestId } : {}),
    ...(sessionToken ? { Cookie: `${STAFF_SESSION_COOKIE}=${sessionToken}` } : {}),
    ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      ...init,
      method,
      headers,
      body,
      signal: controller.signal,
      // Health, inventory and every staff read must never be served stale. An
      // admin surface that showed a just-archived vehicle as still published
      // would be worse than one that was slow.
      cache: "no-store",
    });
  } catch (cause) {
    if (controller.signal.aborted) {
      const timedOut = cause instanceof Error && cause.message === "timeout";
      throw new ApiError({
        kind: timedOut ? "timeout" : "aborted",
        message: timedOut
          ? `Request to ${path} exceeded ${timeoutMs}ms.`
          : `Request to ${path} was aborted.`,
        cause,
      });
    }
    throw new ApiError({
      kind: "network",
      message: `Could not reach the API at ${env.apiUrl}.`,
      cause,
    });
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", onExternalAbort);
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new ApiError({
      kind: "parse",
      status: response.status,
      message: `Response from ${path} was not valid JSON.`,
      cause,
    });
  }
}

/** Reads a resource. Public pages use this. */
export function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>("GET", path, options);
}

/**
 * Writes a resource. Staff server actions use this.
 *
 * `method` is a parameter rather than four separate functions because the write
 * bindings should read as *what they do to the domain* - `apiSend("PATCH", ...)`
 * inside a function called `updateVehicle` - and a transport that grew one
 * function per verb would push that vocabulary into the wrong layer.
 *
 * `session` defaults to `"omit"` even here. Login must not forward a session
 * (there is not one yet) and logout must forward the token in the request body
 * rather than a cookie, so neither wants the default; making the admin
 * bindings opt in explicitly means the sign-in path cannot accidentally replay a
 * stale cookie.
 */
export function apiSend<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>(method, path, options);
}
