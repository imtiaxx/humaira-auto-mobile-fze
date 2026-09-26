import type { Metadata } from "next";

import { Container } from "@/components/ui/container";
import { Divider } from "@/components/ui/divider";
import { Badge } from "@/components/ui/badge";
import {
  ButtonsSection,
  ColourSection,
  FormsSection,
  IconsSection,
  LayoutSection,
  StatesSection,
  SurfacesSection,
  TypographySection,
} from "@/features/design-system/components/sections";

/**
 * Internal design-system catalogue. Not a customer-facing page.
 *
 * `robots: { index: false, follow: false }` keeps it out of search results if it
 * ever ships to a public host. The stronger guarantee - removing the route from
 * production builds entirely - is a one-line change noted in
 * `docs/design-system.md`; it is deliberately *not* done here, because being
 * able to open this page on a staging deployment to review a change is worth
 * more than the defence-in-depth.
 */
export const metadata: Metadata = {
  title: "Design system",
  description: "Internal catalogue of the Humera Automobile design system.",
  robots: { index: false, follow: false, nocache: true },
};

const SECTIONS = [
  { id: "typography", label: "Typography" },
  { id: "colour", label: "Colour" },
  { id: "buttons", label: "Buttons" },
  { id: "forms", label: "Forms" },
  { id: "surfaces", label: "Surfaces" },
  { id: "icons", label: "Icons" },
  { id: "states", label: "States" },
  { id: "layout", label: "Layout" },
] as const;

export default function DesignSystemPage() {
  return (
    <Container className="section-y flex flex-col gap-14">
      <header className="flex max-w-3xl flex-col gap-4">
        <Badge tone="accent">Step 2 &middot; Design system</Badge>
        <h1 className="text-h1 text-fg">Design system</h1>
        <p className="text-body-lg text-fg-secondary">
          Every reusable component, token and state, rendered from the same code
          the rest of the site uses. There is no parallel demo styling: if a
          component looks right here, it looks right on a real page.
        </p>
        <p className="text-body-sm text-fg-muted">
          Internal page &mdash; not indexed, and not part of the public site.
        </p>
      </header>

      {/* In-page navigation. Wrapping rather than scrolling, so on a phone
          every section stays reachable without a hidden horizontal scroll. */}
      <nav aria-label="Design system sections" className="flex flex-wrap gap-2">
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="rounded-sm border border-line-control px-3 py-1.5 text-body-sm text-fg-secondary transition-colors hover:bg-sunken hover:text-fg"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <Divider />

      <div className="flex flex-col gap-16">
        <TypographySection />
        <ColourSection />
        <ButtonsSection />
        <FormsSection />
        <SurfacesSection />
        <IconsSection />
        <StatesSection />
        <LayoutSection />
      </div>

      <Divider label="End" />

      {/*
        A plain div, not a `<footer>`. The site layout now renders the one real
        footer, and two footer landmarks on a single page is a confusing thing to
        meet in a screen reader's landmark list.
      */}
      <div className="flex flex-col gap-3">
        <p className="text-body-sm text-fg-muted">
          Token reference and usage rules are documented in{" "}
          <code className="font-mono text-body-sm text-fg-secondary">
            docs/design-system.md
          </code>
          . Contrast is enforced by{" "}
          <code className="font-mono text-body-sm text-fg-secondary">
            npm run check:contrast
          </code>
          .
        </p>
      </div>
    </Container>
  );
}
