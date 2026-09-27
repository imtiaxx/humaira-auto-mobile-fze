import { WhatsAppCta } from "@/components/cta/whatsapp-cta";
import { Container } from "@/components/ui/container";

/**
 * The page's conversion panel.
 *
 * ---------------------------------------------------------------------------
 * The one enquiry route on this page
 * ---------------------------------------------------------------------------
 * This is the single action a visitor can take, so it carries the full weight of
 * the conversion: the brand's accent button, the site's largest size, and copy
 * that says what happens next rather than exhorting the visitor.
 *
 * It is the same `on-inverse` deep treatment the homepage uses for its
 * conversion panel, reused from the token layer rather than restyled. The
 * `h2` here follows the page's `h1` and the sections' `h2`s, so the outline is
 * unbroken.
 *
 * `unavailable="disabled"` rather than the default `hidden`: this is a page
 * *about* finding a vehicle, so a missing enquiry button would read as an
 * oversight on the page whose entire job is to offer one. With no number
 * configured it renders a visibly unavailable control carrying `aria-disabled`,
 * which tells a screen-reader user why it will not respond instead of leaving
 * them to discover it.
 *
 * The message is pre-filled so the conversation starts with a request already
 * made, and the number itself comes from the environment - never from this file.
 */
export function InventoryCta() {
  return (
    <section aria-labelledby="inventory-cta-heading" className="on-inverse bg-page">
      <Container className="py-16 sm:py-20">
        {/*
          `bg-raised` rather than `bg-page`: the panel now sits inside the page's
          deep scope, where page and panel would otherwise be the same near-black
          and the box would be nothing but its border. A raised surface is what
          makes it read as the last thing on the page.

          The accent edge is the page's closing punctuation - the same red as the
          header's top rule, the price chips and the active nav item, and the only
          element in the panel carrying it.
        */}
        <div className="flex flex-col gap-6 rounded-card border border-line border-l-4 border-l-action-accent bg-raised p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
          <div className="flex max-w-2xl flex-col gap-2">
            <p className="flex items-center gap-2.5 text-label text-fg-accent uppercase">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-action-accent" />
              Sourcing
            </p>
            <h2 id="inventory-cta-heading" className="text-h2 text-fg text-balance">
              Looking for something specific?
            </h2>
            <p className="text-body text-fg-secondary">
              Send us the make, model, year and budget, plus the destination
              country if the vehicle is for export, and we will come back to you
              with what is available in Dubai.
            </p>
          </div>

          <WhatsAppCta
            label="Enquire on WhatsApp"
            ariaLabel="Enquire on WhatsApp about a vehicle"
            message="Hello Humera Automobile, I would like to enquire about sourcing a vehicle."
            unavailable="disabled"
            variant="accent"
            size="lg"
            className="shrink-0 self-start lg:self-center"
          />
        </div>
      </Container>
    </section>
  );
}
