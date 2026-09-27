import Link from "next/link";

import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";
import { buttonClasses } from "@/components/ui/button-styles";
import { STAFF_VEHICLES } from "@/features/staff/lib/routes";

/**
 * The 404 page for the staff area.
 *
 * Distinct from `error.tsx` on purpose. A 404 means "this address is not one of the
 * pages" - a stale bookmark, a typo, a vehicle that no longer exists - and it is a
 * dead end that no amount of retrying will fix. `error.tsx` means "this page exists
 * and broke", and offers a retry. Offering a retry here would teach staff members
 * that retrying helps when it cannot.
 *
 * A `Link` rather than a button calling `notFound()`, because this is a Server
 * Component: there is no click handler to attach one to, and navigating is what a
 * link is for. It also means the destination can be opened in a new tab and works
 * without JavaScript.
 */
export default function StaffNotFound() {
  return (
    <Container className="py-16">
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <SectionHeading
          title="Page not found"
          description="There is no staff page at this address."
        />

        <Surface className="p-5">
          <p className="text-body-sm text-fg-secondary">
            If you followed a link to a vehicle, it may have been removed. The vehicle
            list is the place to look for anything that is still here, and archived
            vehicles are in it too.
          </p>
        </Surface>

        <Link href={STAFF_VEHICLES} className={buttonClasses("primary", "md")}>
          Go to the vehicle list
        </Link>
      </div>
    </Container>
  );
}
