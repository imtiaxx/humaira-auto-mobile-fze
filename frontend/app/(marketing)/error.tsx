"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary.
 *
 * Next 16 renamed the recovery callback from `reset` to `retry`; `retry`
 * re-runs the failed server render or fetch, which is what a visitor expects
 * when they press "try again".
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Surfaces the failure in the browser console during development. A
    // production reporting service is wired in a later step.
    console.error(error);
  }, [error]);

  return (
    <div className="container-page flex flex-col items-start justify-center gap-4 py-24">
      <p className="text-xs font-semibold tracking-[0.18em] text-danger uppercase">
        Something went wrong
      </p>
      <h1 className="text-2xl font-semibold text-fg">This page could not be loaded</h1>
      <p className="max-w-prose text-fg-secondary">
        The error has been logged. You can retry, or return to the home page.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-fg-muted">Reference: {error.digest}</p>
      ) : null}
      {/*
        An inverted white plate - `bg-inverse` with `text-fg-inverse` - so the
        retry action is the brightest thing on an error page. On the black
        canvas that is the right choice: it is the one control that must be
        findable.

        The hover used to be `hover:bg-ink-800`, which was a dark grey on a light
        theme where the plate was already dark. Here the plate is *white*, so
        hovering to a near-black made the button vanish into the page it sits on -
        the control disappeared precisely when it was being pointed at. It now
        steps a step *up* the ramp instead, and the transition uses the system's
        duration token rather than a bare `150ms`.
      */}
      <button
        type="button"
        onClick={() => retry()}
        className="mt-2 inline-flex items-center rounded-sm bg-inverse px-4 py-2.5 text-sm font-semibold text-fg-inverse transition-colors duration-[var(--duration-fast)] hover:bg-ink-200"
      >
        Try again
      </button>
    </div>
  );
}
