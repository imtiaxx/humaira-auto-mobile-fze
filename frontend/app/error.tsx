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
    <main className="container-page flex flex-1 flex-col items-start justify-center gap-4 py-24">
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
      <button
        type="button"
        onClick={() => retry()}
        className="mt-2 inline-flex items-center rounded-sm bg-inverse px-4 py-2.5 text-sm font-semibold text-fg-inverse transition-colors duration-150 hover:bg-ink-800"
      >
        Try again
      </button>
    </main>
  );
}
