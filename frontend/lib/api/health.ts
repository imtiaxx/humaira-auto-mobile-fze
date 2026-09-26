/**
 * Health endpoint bindings.
 *
 * The only resource the API exposes in Step 1. These wrappers exist to prove the
 * transport layer end to end and to give later features a worked example of the
 * pattern: a typed function per endpoint, no `fetch` calls in components.
 */

import { apiGet } from "@/lib/api/client";

/** Mirrors `backend/app/schemas/health.py::HealthResponse`. */
export interface HealthStatus {
  status: "ok" | "degraded";
  service: string;
  version: string;
  environment: string;
  timestamp: string;
}

/** Mirrors `backend/app/schemas/health.py::ReadinessResponse`. */
export interface ReadinessStatus {
  status: "ready" | "not_ready";
  database: "ok" | "unavailable" | "not_configured";
  checked_at: string;
}

export function getHealth(): Promise<HealthStatus> {
  return apiGet<HealthStatus>("/health");
}

export function getReadiness(): Promise<ReadinessStatus> {
  return apiGet<ReadinessStatus>("/health/ready");
}
