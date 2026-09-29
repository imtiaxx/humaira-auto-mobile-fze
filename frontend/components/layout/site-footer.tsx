import { Brand } from "@/components/brand/logo";
import { ContactBlock } from "@/components/cta/contact-actions";
import { Container } from "@/components/ui/container";
import { Divider } from "@/components/ui/divider";
import { NavList } from "@/components/layout/nav-list";
import { FOOTER_NAV, type NavGroup } from "@/navigation/config";
import { LEGAL_NAME, SHOWROOM_ADDRESS_LINES, SITE_NAME, SOCIAL_LINKS } from "@/config/site";

/**
 * The global site footer.
 *
 * A Server Component. The only client island is the navigation list, shared with
 * the header so the active-route rules are written once.
 *
 * ---------------------------------------------------------------------------
 * Group headings
 * ---------------------------------------------------------------------------
 * The four column headings are real `<h2>`s, not styled `<div>`s. That is what
 * gives the footer a correct place in the document outline, and it means a
 * screen-reader user can jump to "Export" the same way they jump to a section
 * heading on a page. `NavList` renders plain items, so the semantics come from
 * here.
 *
 * Each group is labelled for the mobile drawer and the footer alike through its
 * `id`, and the list is wrapped in a labelled `<nav>` so the link groups are
 * announced as navigation landmarks rather than as loose lists.
 */
export function SiteFooter() {
  return (
    // The footer closes the composition the hero opens.
    //
    // It was `bg-sunken`, the same grey as the services section directly above it,
    // so the page simply stopped. On the black showroom canvas the brand block,
    // the link columns and the contact details read as one surface rather than as
    // a grey strip bolted on underneath.
    //
    // The columns, `NavList` and `ContactBlock` below are untouched by the
    // black + red + white re-theme, which is the payoff of putting the palette in
    // the token layer instead of in the components: the page went from a light
    // grey footer to a near-black one without an edit to any of them.
    //
    // The red rule is the only accent down here, for the same reason the header
    // has one - it is the brand's light strip, and it stops a black bar on a
    // black page from looking like a rendering failure.
    <footer className="relative mt-auto border-t border-line bg-page">
      <span aria-hidden="true" className="rule-accent" />
      <Container className="flex flex-col gap-10 py-12 md:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/*
            Identity column. `lg:col-span-4` against four link columns of two
            each, so the brand block gets a third of the width and the columns
            share the rest - the proportion a dealership footer usually settles
            on.
          */}
          <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-4">
            <Brand size="md" />
            <p className="max-w-prose text-body-sm text-fg-secondary">
              Vehicle sales and international export from Dubai.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:col-span-6 lg:grid-cols-4">
            {FOOTER_NAV.map((group) => (
              <FooterGroup key={group.id} group={group} />
            ))}
          </div>

          <ContactBlock headingLevel="h2" className="lg:col-span-2" />
        </div>

        {/*
          Social links render only when verified profiles exist. `SOCIAL_LINKS` is
          empty, so this row is absent from the page entirely rather than showing
          a row of disabled or placeholder icons.
        */}
        {SOCIAL_LINKS.length > 0 ? (
          <>
            <Divider />
            <nav aria-label="Social media" className="flex items-center gap-2">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.network}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer me"
                  className="text-body-sm text-fg-secondary underline-offset-4 transition-colors duration-[var(--duration-fast)] hover:text-fg hover:underline"
                >
                  {social.label}
                </a>
              ))}
            </nav>
          </>
        ) : null}

        <Divider />

        <div className="flex flex-col gap-1">
          {/*
            Copyright. `LEGAL_NAME` is null because the registered entity name is
            not confirmed; the trading name is shown instead, and the legal line
            appears when there is a name to put in it. Never a guess.
          */}
          <p className="text-body-sm text-fg-secondary">
            &copy; {new Date().getFullYear()} {LEGAL_NAME ?? SITE_NAME}
          </p>
          {LEGAL_NAME ? (
            <p className="text-caption text-fg-muted">{SITE_NAME}</p>
          ) : null}
          {/* Address comes from config, so it cannot drift from the contact block. */}
          <address className="text-caption text-fg-muted not-italic">
            {SHOWROOM_ADDRESS_LINES.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
        </div>
      </Container>
    </footer>
  );
}

/**
 * One footer column.
 *
 * `id` on the heading plus `aria-labelledby` on the nav means each column is a
 * separately named navigation landmark, so a screen-reader user listing
 * landmarks hears "Vehicles" and "Export" rather than four anonymous lists.
 */
function FooterGroup({ group }: { group: NavGroup }) {
  const headingId = `footer-nav-${group.id}`;

  return (
    <nav aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className="text-label text-fg-muted">
        {group.title}
      </h2>
      <NavList items={group.items} variant="stacked" />
    </nav>
  );
}
