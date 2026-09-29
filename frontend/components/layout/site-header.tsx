import { BrandLink } from "@/components/brand/logo";
import { HeaderContactAction } from "@/components/cta/contact-actions";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavList } from "@/components/layout/nav-list";
import { Container } from "@/components/ui/container";
import { PRIMARY_NAV } from "@/navigation/config";

/**
 * The global site header.
 *
 * A Server Component. Everything in it is static HTML except two islands: the
 * navigation list (which needs the pathname to mark the current page) and the
 * mobile drawer. The brand, the contact action and the bar's own markup cost
 * nothing on the client.
 *
 * ---------------------------------------------------------------------------
 * Why it is sticky
 * ---------------------------------------------------------------------------
 * A visitor reading a vehicle listing and deciding whether to enquire should not
 * have to scroll to the bottom of the page to find a way to make contact. The
 * header is the one piece of chrome that is worth pinning, and it is pinned
 * rather than static so the contact action is always one glance away.
 *
 * The page is not hidden behind it: `globals.css` sets `scroll-padding-top` to
 * clear the header, so an in-page anchor link does not land underneath it.
 *
 * ---------------------------------------------------------------------------
 * Why one breakpoint
 * ---------------------------------------------------------------------------
 * The bar collapses to the drawer at `lg` (1024px), not at `md`. That is a
 * deliberate choice against the Step 2 convention of switching early: eight
 * navigation labels plus a brand lockup plus a contact action do not fit at
 * 768px without truncating or wrapping, and a two-row header is the "giant
 * header" the brief rules out. Below 1024px the drawer is both safer and
 * simpler, so that is where it starts.
 */
export function SiteHeader() {
  return (
    <header
      className={[
        "sticky top-0 z-30",
        // Opaque, and it is now the *same* near-black as the page, with a hairline
        // that carries the separation. The bar used to need a fill of its own to
        // read against a light page; on the black canvas `bg-page` is a no-op
        // colour-wise and the border is doing all the work - which is why the
        // 1px line below is not decorative.
        "border-b border-line bg-page",
        // A red line under the bar, and it is the one place on the site a red
        // edge is unconditional rather than a response to the pointer. It reads as
        // the brand's light strip and is what stops a black bar on a black page
        // looking like a rendering failure.
        "after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-accent-600/70",
      ].join(" ")}
    >
      <Container className="flex h-16 items-center justify-between gap-4 lg:h-20">
        {/*
          The small lockup below `lg` and the full-size one from `lg` up.

          Each is wrapped rather than given a `hidden` / `lg:inline-flex` pair
          directly, because `BrandLink` already sets `inline-flex` on itself and
          `cn()` is a plain joiner with no conflict resolution: the two display
          utilities would both apply below `lg` and the winner would be decided by
          the order Tailwind happens to emit them in. That is not hypothetical -
          it rendered both lockups at once, so a phone showed the logo twice.

          The wrapper carries the responsive display instead, and the anchor
          inside keeps the `inline-flex` it needs for the mark-and-wordmark row.
        */}
        <span className="lg:hidden">
          <BrandLink size="md" logoOnly />
        </span>
        <span className="hidden lg:block">
          <BrandLink size="lg" logoOnly />
        </span>

        {/*
          Desktop navigation. `hidden lg:flex` rather than rendering it and
          hiding it with `aria-hidden`, so the links are not in the accessibility
          tree or the tab order on a phone - where the drawer is the only
          navigation that should exist.
        */}
        <nav aria-label="Main" className="hidden min-w-0 flex-1 lg:flex lg:justify-end">
          <NavList items={PRIMARY_NAV} variant="desktop" />
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {/*
            One prominent contact action, per the brief. It renders nothing while
            no contact channel is configured, which is currently the case - see
            `HeaderContactAction`.
          */}
          <span className="hidden lg:inline-flex">
            <HeaderContactAction />
          </span>
          <MobileNav />
        </div>
      </Container>
    </header>
  );
}
