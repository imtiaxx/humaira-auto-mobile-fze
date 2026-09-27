import { WhatsAppFloat } from "@/components/cta/whatsapp-cta";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

/**
 * The public site's chrome: header, footer and the floating contact action.
 *
 * ---------------------------------------------------------------------------
 * What a route group is, and why this is one
 * ---------------------------------------------------------------------------
 * A folder wrapped in parentheses is a route group: it exists to organise files
 * and is **omitted from the URL**. `app/(marketing)/inventory/page.tsx` serves
 * `/inventory`, exactly as `app/inventory/page.tsx` did before the move. Nothing
 * about the public site's addresses, links or metadata changed.
 *
 * What changed is that these three components now render only for pages in this
 * group. The admin area under `app/staff/` has its own chrome, and a staff member
 * editing inventory is not served a marketing navigation bar, a footer full of
 * links to unbuilt pages, or a floating WhatsApp button.
 *
 * ---------------------------------------------------------------------------
 * Why the group is named `marketing` and not `site` or `public`
 * ---------------------------------------------------------------------------
 * Because that is what it contains: the pages a visitor browses. The name is a
 * statement about purpose rather than about location, which is what makes a group
 * like this worth having - someone adding a route can tell from the folder alone
 * whether it belongs on the public site or in the staff tool, and putting it in
 * the wrong one produces a page wearing the wrong interface.
 */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />

      {/*
        The `<main>` and the skip link live in the root layout, not here, so that
        the admin area has one too and neither shell can ship a document with no
        main landmark or two of them.
      */}
      {children}

      <SiteFooter />

      {/*
        Floating contact action. Renders nothing until a WhatsApp number is
        configured, so it costs no DOM today.
      */}
      <WhatsAppFloat />
    </>
  );
}
