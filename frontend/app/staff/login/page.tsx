import type { Metadata } from "next";

import { getStaffSession } from "@/lib/staff/dal";
import { redirect } from "next/navigation";
import { StaffLoginForm } from "@/features/staff/components/staff-login-form";
import { Container } from "@/components/ui/container";
import { STAFF_HOME } from "@/features/staff/lib/routes";

/**
 * Staff sign-in.
 *
 * ---------------------------------------------------------------------------
 * Why this page asks the API whether it is needed
 * ---------------------------------------------------------------------------
 * `proxy.ts` already redirects a request that has no session cookie, so on a
 * plain browser navigation this page is only ever reached when there is no
 * cookie - or when the cookie is stale. A stale cookie is exactly the case where
 * an optimistic check is wrong, and this is the one page in the admin area where
 * showing a login form to somebody who is already signed in is genuinely
 * confusing rather than merely redundant.
 *
 * So this page re-checks against the backend and steps aside. It is one API call
 * on a route that is not hot, and it is the difference between "sign in" and
 * "you are already signed in as <name>" at the moment the two are both plausible.
 *
 * ---------------------------------------------------------------------------
 * Why there is no guard above this page
 * ---------------------------------------------------------------------------
 * There is no `app/staff/layout.tsx`. The authenticated layout lives in
 * `app/staff/(app)/layout.tsx`, so this route is outside it - which is the
 * structural reason a signed-out visitor can reach the form at all. A guard here
 * would redirect the login form to itself.
 */
export const metadata: Metadata = {
  title: "Sign in",
  // Stated here as well as in the authenticated layout. A login form is the last
  // thing that should be indexed, and it is the one page in the admin area that a
  // search engine has no reason to be redirected away from before it fetches.
  robots: { index: false, follow: false, nocache: true },
};

export default async function StaffLoginPage() {
  // The authoritative check, made before rendering the form. A live session means
  // this page has nothing to offer.
  if (await getStaffSession()) redirect(STAFF_HOME);

  return (
    <Container className="flex min-h-full items-center justify-center py-16">
      {/*
        `max-w-md` because a sign-in form is one column of two fields. Stretching
        it to the container width makes the inputs a sentence long, and the wider
        box implies there is more on the page than there is.
      */}
      <div className="w-full max-w-md">
        <div className="mb-8">
          <h1 className="text-display-sm text-fg">Staff sign in</h1>
          <p className="mt-2 text-body text-fg-muted">
            This area is for staff. Accounts are created by an operator - there is
            no public registration.
          </p>
        </div>

        <StaffLoginForm />
      </div>
    </Container>
  );
}
