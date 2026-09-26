/**
 * HTTP client for the Humera Automobile API.
 *
 * One place that knows how to talk to the backend: base URL, timeout, JSON
 * handling, correlation IDs and error normalisation. Feature code calls typed
 * wrappers in `./health.ts` (and future modules) and never touches `fetch`
 * directly, which keeps the transport swappable and the error contract uniform.
 *
 * Server Components only, for now. The client deliberately contains no
 * `"use client"` directive: data fetching happens on the server so API secrets
 * and the database stay out of the browser. Interactive features that need
 * client-side calls will go through a Route Handler rather than widening this
 * module's surface.
 */

import { env } from "@/lib/env";
import { ApiError, isApiErrorEnvelope } from "@/lib/api/errors";

/** Matches the backend's `API_V1_PREFIX`. */
const API_PREFIX = "/api/v1";

/** Requests that outlive this are almost certainly a stuck connection. */
const DEFAULT_TIMEOUT_MS = 10_000;

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** JSON-serialisable request body. */
  json?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
  /** Forwarded as `X-Request-ID` so a frontend trace can be matched to a log. */
  requestId?: string;
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
 * Performs a request against the API and returns the decoded JSON body.
 *
 * @typeParam T - Shape the caller expects. This is an assertion, not a check;
 * validate untrusted payloads at the boundary when endpoints accept input.
 */
export async function apiGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json: _json, query, timeoutMs = DEFAULT_TIMEOUT_MS, requestId, ...init } = options;
  void _json;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("timeout")), timeoutMs);

  // Allow the caller to cancel without losing the distinction from a timeout.
  const onExternalAbort = () => controller.abort(init.signal?.reason);
  init.signal?.addEventListener("abort", onExternalAbort, { once: true });

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      ...init,
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(requestId ? { "X-Request-ID": requestId } : {}),
        ...init.headers,
      },
      signal: controller.signal,
      // Health and inventory data must never be served from the router cache.
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
