import type { Metadata } from "next";

import { requireStaff } from "@/lib/staff/dal";
import { StaffNav } from "@/features/staff/components/staff-nav";

/**
 * The authenticated staff area: the guard, and the shell around it.
 *
 * ---------------------------------------------------------------------------
 * Why the guard lives here and not in each page
 * ---------------------------------------------------------------------------
 * Because this is the one layout that wraps every authenticated staff page, so a
 * check here cannot be forgotten. The alternative - calling `requireStaff()` at
 * the top of each page - is the arrangement that eventually produces a new page
 * where nobody copied the line, and the symptom is an admin page rendering for a
 * signed-out visitor. One check, in the place that structurally encloses
 * everything, is the version that stays correct.
 *
 * It is a *layout* guard and not a Proxy guard, and the distinction is the whole
 * point of the two-layer arrangement. `proxy.ts` asks whether a cookie exists, on
 * every request, cheaply, and is allowed to be wrong. This asks the backend
 * whether the session is live, once per render, and is the authoritative answer.
 * Nothing is rendered on the strength of the Proxy's opinion.
 *
 * ---------------------------------------------------------------------------
 * Why the login form is *not* under this layout
 * ---------------------------------------------------------------------------
 * Because it has to be reachable without a session. A guard in a layout that
 * wrapped the login form would redirect the login form to itself.
 *
 * So `/staff/login` sits outside the `(app)` group this file lives in. The
 * directory is named for what it holds - the authenticated application - and the
 * two facts that follow from that are structural rather than conventional: the
 * guard covers exactly the routes beneath it, and the login form is exactly the
 * one staff route that is outside it.
 *
 * ---------------------------------------------------------------------------
 * Where the document shell is
 * ---------------------------------------------------------------------------
 * `<html>`, `<body>`, the fonts, the global stylesheet, the skip link and the
 * single `<main>` are in `app/layout.tsx`, shared with the public site. This file
 * renders staff chrome *inside* that `<main>` - a bar at the top of the content
 * rather than site furniture that has to align with a footer. See the note in
 * `app/(marketing)/layout.tsx` for why there is one root layout rather than two.
 */

/**
 * Staff pages must never be indexed, and the directive is set here as well as in
 * the root layout on purpose.
 *
 * The root already declares the whole site `index: false, follow: false`, and
 * repeating that at the root of a subtree usually reads as redundancy. This is the
 * one place it is worth repeating: the root's `robots` is a statement about the
 * marketing site, and this is a subtree that only ever exists for people with a
 * session. If the site is ever made indexable by flipping one value at the root,
 * the change should not silently expose an internal tool - so the admin area
 * states its own position and does not inherit the marketing site's.
 */
export const metadata: Metadata = {
  title: "Staff",
  robots: { index: false, follow: false, nocache: true },
};

export default async function StaffAppLayout({ children }: LayoutProps<"/staff">) {
  // The authoritative check. Throws a redirect to `/staff/login` when there is no
  // live staff session, so no child component ever renders for a caller the
  // backend has refused.
  const staff = await requireStaff();

  return (
    <div className="flex min-h-full flex-col">
      <StaffNav staff={staff} />

      {/*
        Not `<main>`: the document's single `<main>` is in `app/layout.tsx`, and
        two main landmarks on a page is an accessibility failure rather than a
        styling detail. This is a labelled `<section>` so the staff area can still
        be reached as a region by a screen reader.
      */}
      <section aria-label="Staff area" className="flex-1">
        {children}
      </section>
    </div>
  );
}
