/**
 * System status feature.
 *
 * A developer-facing diagnostic page, not a customer-facing feature. Its job is
 * to prove that the frontend's typed API client, environment configuration and
 * error handling work against the real backend, and to make a broken
 * environment obvious in one glance instead of through a blank page.
 *
 * It shows live values from the API. It contains no mock data and no fallbacks:
 * if the backend is down, this page says so.
 */

import type { Metadata } from "next";

import { getHealth, getReadiness } from "@/lib/api/health";
import { ApiError } from "@/lib/api/errors";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";
import { CheckRow, type CheckState } from "@/features/system-status/components/check-row";

export const metadata: Metadata = {
  title: "System status",
  robots: { index: false, follow: false },
};

/** Maps a database state reported by the backend onto a pass/fail. */
function databaseState(state: "ok" | "unavailable" | "not_configured"): CheckState {
  if (state === "ok") return "pass";
  if (state === "unavailable") return "fail";
  return "pending";
}

export default async function SystemStatusPage() {
  const [health, readiness] = await Promise.allSettled([getHealth(), getReadiness()]);

  const healthError = health.status === "rejected" ? health.reason : null;
  const readinessError = readiness.status === "rejected" ? readiness.reason : null;

  const describe = (error: unknown): string =>
    error instanceof ApiError
      ? `${error.userMessage} (${error.kind}${error.status ? ` ${error.status}` : ""})`
      : "Unexpected error.";

  const allHealthy =
    health.status === "fulfilled" &&
    readiness.status === "fulfilled" &&
    readiness.value.status === "ready";

  return (
    <Container as="main" className="flex flex-1 flex-col gap-10 py-14 md:py-20">
      <SectionHeading
        eyebrow="Diagnostics"
        title="System status"
        description="Live values reported by the backend. No data on this page is mocked or cached."
      />

      <Surface className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-fg">Service checks</h2>
          <Badge tone={allHealthy ? "success" : "danger"}>
            {allHealthy ? "All systems operational" : "Attention required"}
          </Badge>
        </div>

        <ul className="divide-y divide-line">
          <CheckRow
            label="API liveness"
            detail="GET /api/v1/health"
            value={
              health.status === "fulfilled" ? health.value.version : describe(healthError)
            }
            state={health.status === "fulfilled" ? "pass" : "fail"}
          />
          <CheckRow
            label="Environment"
            detail="Reported by the running service"
            value={
              health.status === "fulfilled" ? health.value.environment : "unavailable"
            }
            state={health.status === "fulfilled" ? "pass" : "fail"}
          />
          <CheckRow
            label="Readiness"
            detail="GET /api/v1/health/ready"
            value={
              readiness.status === "fulfilled" ? readiness.value.status : describe(readinessError)
            }
            state={readiness.status === "fulfilled" ? "pass" : "fail"}
          />
          <CheckRow
            label="Database"
            detail="PostgreSQL connectivity"
            value={
              readiness.status === "fulfilled" ? readiness.value.database : "unreachable"
            }
            state={
              readiness.status === "fulfilled"
                ? databaseState(readiness.value.database)
                : "fail"
            }
          />
        </ul>
      </Surface>

      {healthError || readinessError ? (
        <Surface variant="sunken" className="flex flex-col gap-2 p-5">
          <h2 className="text-sm font-semibold text-fg">Failure detail</h2>
          <p className="text-sm text-fg-secondary">
            {describe(healthError ?? readinessError)}
          </p>
          <p className="text-xs text-fg-muted">
            Confirm the backend is running on port 8000 and that
            <code className="mx-1 font-mono">NEXT_PUBLIC_API_URL</code> is correct.
          </p>
        </Surface>
      ) : null}
    </Container>
  );
}
