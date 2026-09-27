"use client";

import { useEffect } from "react";
import Link from "next/link";

import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Cluster, Stack } from "@/components/ui/stack";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";
import { STAFF_VEHICLES } from "@/features/staff/lib/routes";

/**
 * The error boundary for the signed-in staff area.
 *
 * ---------------------------------------------------------------------------
 * Why this exists at all
 * ---------------------------------------------------------------------------
 * Because several things in this area throw on purpose. Archive, restore, promote
 * and delete are buttons, not forms, so they have nowhere to render a failure - so
 * they throw, and this is where that lands.
 *
 * The alternative was a `try`/`catch` around every one of them that quietly
 * returned, and that is worse in a specific way: a swallowed failure leaves the
 * staff member looking at a page that says the vehicle is still published, when
 * the archive actually succeeded. A visible error that says "this did not happen"
 * is the honest outcome, and it is better than a confident lie.
 *
 * ---------------------------------------------------------------------------
 * Why a 401 is a link to the login form and not a stack trace
 * ---------------------------------------------------------------------------
 * Because a 401 is the one failure here that the reader can do something about, and
 * because the most likely cause is mundane: a session that expired overnight. The
 * API's own wording is shown, and the page offers the way out.
 *
 * Everything else is deliberately opaque. A staff member has no use for a FastAPI
 * traceback, and printing one leaks internal paths and parameter names into a page
 * that a browser extension or a shared screen can photograph. The detail is logged
 * to the server console instead, where the person who can act on it will find it.
 */
export default function StaffError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const expired = error instanceof ApiError && error.status === 401;

  useEffect(() => {
    // The server console, not the page. See the note above.
    console.error("Staff area error:", error);
  }, [error]);

  return (
    <Container className="py-16">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <SectionHeading
          title={expired ? "Your session has expired" : "Something went wrong"}
          description={
            expired
              ? "Sign in again and pick up where you left off. Nothing you were editing has been lost."
              : "This page could not be shown. The change you were making was not applied."
          }
        />

        <Surface className="p-5">
          {expired ? (
            <p className="text-body-sm text-fg-secondary">
              The backend rejected the request as unauthenticated. This is normal
              after a period of inactivity, and after signing out on another device.
            </p>
          ) : (
            <Stack gap="sm">
              <p className="text-body-sm text-fg-secondary">
                The error has been logged. If it keeps happening, the details in that
                log are what identifies the cause.
              </p>

              {/*
                The digest, when there is one. Next generates it server-side and it
                correlates this page with the server log line, so it is the one piece
                of information that helps - and it is a hash, so it identifies the
                occurrence without describing the error.
              */}
              {error.digest ? (
                <p className="text-body-sm text-fg-muted">
                  Reference: <code className="font-mono">{error.digest}</code>
                </p>
              ) : null}
            </Stack>
          )}
        </Surface>

        {/*
          `reset` re-renders the segment, which is the right first thing to try -
          most of what reaches here is a failed fetch, and the data may well be
          readable now. A separate "reload the page" button is deliberately absent:
          a full reload also throws away whatever the staff member had typed into a
          form on this route, which is a worse default than a retry that does not.
          The vehicle list link below is the escape hatch when retrying is not the
          answer, and it is a link so it can be opened, bookmarked and middle-clicked.
        */}
        <Cluster gap="sm">
          <Button type="button" onClick={reset}>
            Try again
          </Button>

          <Link
            href={STAFF_VEHICLES}
            className="text-body-sm text-fg-secondary underline underline-offset-4 hover:text-fg"
          >
            Go to the vehicle list
          </Link>
        </Cluster>
      </div>
    </Container>
  );
}
