import Link from "next/link";
import type { Route } from "next";

import { signOutAction } from "@/app/staff/actions/auth";
import { Container } from "@/components/ui/container";
import { buttonClasses } from "@/components/ui/button-styles";
import { STAFF_HOME, STAFF_VEHICLES } from "@/features/staff/lib/routes";
import type { StaffUser } from "@/types/staff";

/**
 * The staff area's top bar: where you are, who you are, and the way out.
 *
 * ---------------------------------------------------------------------------
 * Why this is a Server Component
 * ---------------------------------------------------------------------------
 * It renders the signed-in staff member's name and the sign-out form, and needs
 * no interactivity of its own. The only interactive element is a submit button
 * inside a form that posts to a server action, and that works from the server.
 * Marking this `"use client"` would ship the staff member's name and email
 * address to the browser in order to draw a bar that needed neither.
 *
 * ---------------------------------------------------------------------------
 * Why sign-out is a form, not a link
 * ---------------------------------------------------------------------------
 * Because it changes something on the server. A link that revoked a session would
 * be a GET, and a GET that changes state is a link any page, prefetcher or
 * browser extension could trigger by following it. A form posting to a server
 * action cannot be navigated to, cannot be prefetched, and cannot be fired by a
 * crawler's visit to the admin URL.
 *
 * It is scoped to a single button rather than wrapping the page, so a stray Enter
 * key in a form field cannot sign the staff member out mid-edit.
 */
export function StaffNav({ staff }: { staff: StaffUser }) {
  return (
    <header className="border-b border-line bg-raised">
      <Container className="flex flex-wrap items-center gap-x-6 gap-y-3 py-3">
        <div className="flex items-baseline gap-3">
          <span className="text-body-sm font-semibold text-fg">Staff</span>
          {/*
            A `<nav>` for the destinations, separate from the identity block. The
            bar holds two different things - where you can go, and who you are -
            and wrapping both in one landmark would give a screen reader a single
            undifferentiated list.
          */}
          <nav aria-label="Staff sections" className="flex items-center gap-4">
            <StaffNavLink href={STAFF_HOME}>Dashboard</StaffNavLink>
            <StaffNavLink href={STAFF_VEHICLES}>Vehicles</StaffNavLink>
          </nav>
        </div>

        {/*
          `ml-auto` rather than a second row: the identity block sits at the far
          end of the bar on a wide screen and wraps onto its own line on a narrow
          one, which is the behaviour a flex row with wrapping gives for free.
        */}
        <div className="ml-auto flex items-center gap-4">
          <span className="text-body-sm text-fg-muted">
            {/*
              The name, not the email. The person using this is already known to
              be staff - the guard proved it - so the address is not the useful
              half, and the backend's own `StaffUserResponse` is deliberately
              narrow for exactly this reason.
            */}
            <span className="text-fg">{staff.fullName}</span>
          </span>

          <form action={signOutAction}>
            <button type="submit" className={buttonClasses("ghost", "sm")}>
              Sign out
            </button>
          </form>
        </div>
      </Container>
    </header>
  );
}

/**
 * One staff destination.
 *
 * Uses `next/link` so navigation between admin pages is a client transition
 * rather than a document load - the staff area is a tool, and losing scroll
 * position and re-running every server render on each hop makes it feel like a
 * website rather than an application.
 *
 * `href` is typed as Next's `Route` rather than `string`, and that is the whole
 * reason this is not inlined. A `string` prop is assignable from anything and
 * assignable *to* anything, so every link in the bar would compile no matter which
 * route it named - and a renamed page would leave a staff member clicking a link
 * to a 404. `Route` is the union Next generates from the app directory, so the
 * compiler rejects a path that is not one of these pages.
 */
function StaffNavLink({ href, children }: { href: Route; children: string }) {
  /*
    `prefetch={false}`, explicitly.

    This is a correction to an earlier version of this comment, which claimed that
    leaving `prefetch` at its default meant it was off. It is not: the default is
    `true` in the App Router, and in Next 15.4+ a prefetch is issued on pointer
    *enter* rather than on visibility.

    So the previous version prefetched the admin tree, and each prefetch is an
    authenticated request to the API - the proxy lets them through on the strength
    of the cookie alone. That is spend nobody asked for, on links a staff member may
    never click. The cost of turning it off is a slightly slower first hop, which is
    the right thing to trade for an area nobody should be casually crawling.
  */
  return (
    <Link
      href={href}
      prefetch={false}
      className="text-body-sm font-medium text-fg-secondary transition-colors hover:text-fg"
    >
      {children}
    </Link>
  );
}
