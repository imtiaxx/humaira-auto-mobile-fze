import type { Metadata } from "next";

import { ActionLink } from "@/components/ui/action-link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/**
 * 404 boundary. Rendered by Next for any unmatched route, so the links here
 * must be safe destinations that exist regardless of how much of the site has
 * been built.
 */
export default function NotFound() {
  return (
    <main className="container-page flex flex-1 flex-col items-start justify-center gap-5 py-24">
      <p className="font-mono text-sm text-fg-muted">404</p>
      <h1 className="text-3xl font-semibold text-fg">This page does not exist</h1>
      <p className="max-w-prose text-fg-secondary">
        The link may be out of date, or the page may have been moved.
      </p>
      <ActionLink href="/" tone="primary">
        Back to home
      </ActionLink>
    </main>
  );
}
