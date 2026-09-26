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
        // Translucent with a blur so content scrolling underneath is softened
        // rather than colliding with the bar. The fallback background is opaque,
        // so a browser without `backdrop-filter` gets a solid bar - which is
        // what most of them need anyway for legibility over arbitrary content.
        "border-b border-line bg-page/85 backdrop-blur-md",
        // `supports-` rather than an unconditional blur, so browsers without it
        // do not get a translucent bar with no blur behind it.
        "supports-[backdrop-filter]:bg-page/70",
      ].join(" ")}
    >
      <Container className="flex h-16 items-center justify-between gap-4 lg:h-20">
        <BrandLink size="sm" className="lg:hidden" />
        <BrandLink size="md" className="hidden lg:inline-flex" />

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
