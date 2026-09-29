/**
 * Typed error raised by the API client.
 *
 * Every failure - transport, timeout, HTTP status, malformed body - surfaces
 * as an `ApiError`, so calling code has exactly one error type to handle and
 * never has to guess whether a rejected promise means "the server said no" or
 * "the server was unreachable". Those are materially different situations for
 * a customer-facing enquiry form.
 */

import type { ApiErrorEnvelope } from "@/types/api";

export type ApiErrorKind =
  /** The request never completed: DNS, connection refused, TLS failure. */
  | "network"
  /** The request exceeded the configured timeout. */
  | "timeout"
  /** The request was aborted by the caller. */
  | "aborted"
  /** The server returned a non-2xx status. */
  | "http"
  /** A 2xx response whose body did not match the expected shape. */
  | "parse";

export interface ApiErrorOptions {
  kind: ApiErrorKind;
  message: string;
  status?: number;
  /** Machine-readable code from the backend, when present. */
  code?: string;
  /** Backend correlation ID - quote this in support requests. */
  requestId?: string;
  /**
   * The backend's `error.details`, when it sent any.
   *
   * Carried through untyped because the shape is per-error: a `422` puts
   * Pydantic's field list there, and a domain error puts prose. The one caller
   * that cares - the public enquiry form, which maps validation failures back
   * onto the control that caused them - narrows it itself, and a second type
   * hierarchy for error bodies would be more machinery than the one consumer
   * justifies.
   */
  details?: unknown;
  cause?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly requestId: string | undefined;
  readonly details: unknown;

  constructor(options: ApiErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "ApiError";
    this.kind = options.kind;
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.details = options.details;
  }

  /** True when retrying the same request could plausibly succeed. */
  get isRetryable(): boolean {
    if (this.kind === "network" || this.kind === "timeout") return true;
    if (this.kind !== "http" || this.status === undefined) return false;
    return this.status === 408 || this.status === 429 || this.status >= 500;
  }

  /** Message safe to render to a customer. Never leaks internals. */
  get userMessage(): string {
    switch (this.kind) {
      case "network":
        return "We could not reach the server. Please check your connection and try again.";
      case "timeout":
        return "The server took too long to respond. Please try again.";
      case "parse":
        return "The server returned an unexpected response. Please try again shortly.";
      case "http":
        return this.status === 404
          ? "The requested item could not be found."
          : "The request could not be completed. Please try again.";
      default:
        return "The request was cancelled.";
    }
  }
}

/** Narrow an unknown value to the backend's error envelope. */
export function isApiErrorEnvelope(value: unknown): value is ApiErrorEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return false;
  const { code, message, request_id: requestId } = error as Record<string, unknown>;
  return typeof code === "string" && typeof message === "string" && typeof requestId === "string";
}
