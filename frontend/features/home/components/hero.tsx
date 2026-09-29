import { WhatsAppCta } from "@/components/cta/whatsapp-cta";
import { Container } from "@/components/ui/container";
import { actionClasses } from "@/components/ui/action-link";
import { HeroSlider } from "@/features/home/components/hero-slider";
import { SHOWROOM_ADDRESS_ONE_LINE } from "@/config/site";

/**
 * Homepage hero.
 *
 * A Server Component. It has no state and no event handlers, so it ships zero
 * client JavaScript - the whole page above the fold is server-rendered HTML.
 *
 * ---------------------------------------------------------------------------
 * Every claim on this page is traceable to the repository
 * ---------------------------------------------------------------------------
 * There is no invented statistic, no testimonial, no customer count, no review
 * score and no "trusted by" row. Concretely, that rules out the three things a
 * template hero of this kind normally reaches for:
 *
 *   - "500+ vehicles sold"          - a number nobody has verified
 *   - "Trusted by buyers worldwide"  - an unfalsifiable claim about buyers
 *   - a wall of customer logos       - implies relationships that may not exist
 *
 * What the hero says instead is only what `config/site.ts` and
 * `navigation/config.ts` already establish: this is a Dubai vehicle sales and
 * international export business with a showroom in Ras Al Khor, and it also
 * sources vehicles on request. That is a genuinely strong position for a
 * visitor, and stating it plainly is more convincing than a number would be.
 *
 * ---------------------------------------------------------------------------
 * The two calls to action
 * ---------------------------------------------------------------------------
 * Primary is the WhatsApp enquiry. It is environment-controlled and renders
 * visibly disabled while `NEXT_PUBLIC_WHATSAPP_NUMBER` is unset - see the
 * comment on `WhatsAppCta` for why the alternatives are worse. No phone number
 * is written into this file, or anywhere else in the project.
 *
 * Secondary points at the service section further down this same page. That is
 * a real destination, which matters more than it might look: `/inventory` and
 * `/export` are declared `planned` in `navigation/config.ts` and deliberately
 * are not routes yet, so linking to them would put a 404 behind the second most
 * prominent button on the site. An in-page anchor is the only honest target
 * available, and it is genuinely useful rather than a placeholder.
 */

/**
 * Stagger for the entrance animation.
 *
 * Four steps of 70ms, applied to the eyebrow, headline, paragraph and CTA row.
 * The cap matters: without it a longer headline would drift the CTA row well
 * past the point where the animation still reads as responsive.
 */
function rise(index: number): string {
  return `animate-fade-up [animation-delay:${index * 70}ms]`;
}

export function Hero() {
  return (
    <section
      // `aria-labelledby` rather than `aria-label`: the visible headline is the
      // section's name, and referencing it means a screen reader announces the
      // same words a sighted visitor reads.
      aria-labelledby="hero-heading"
      // Step 6. `on-inverse` re-points the semantic token layer for this subtree,
      // so every `text-fg*` / `border-line` / `bg-raised` below resolves against
      // near-black instead of near-white without a single one of them changing.
      // This is the site's primary surface: the deep canvas is what makes the
      // brand read as an established trading company rather than a light
      // template, and it is where the brass accent has room to actually register.
      className="on-inverse relative overflow-hidden bg-page"
    >
      {/*
        Step 6: a single soft lift behind the copy rather than the previous wash.

        On the light canvas this was a near-white ellipse fading into near-white,
        which is close to invisible - it read as a slightly dirty patch rather
        than as depth. Drawn from `--surface-raised` (one step above the base) it
        now behaves like a spotlight: the headline sits in the brightest part of
        the canvas and the artwork falls away toward the edges. It is a gradient
        of one surface onto another, not a hue gradient, so it cannot shift the
        perceived contrast of the type above it.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(ellipse_58%_52%_at_38%_0%,var(--surface-raised),transparent)]"
      />

      <Container className="pb-16 pt-12 md:pb-20 md:pt-20 lg:pb-24 lg:pt-28">
        {/*
          `lg:grid-cols-12` with the copy on 7 columns and the artwork on 5. The
          copy gets the larger share deliberately: on a site with no photography
          yet, the words are the product, and the artwork is supporting cast.

          Step 6: the two columns are separated by a single hairline instead of
          by a gap. `lg:gap-0` plus padding either side of a `border-l` makes the
          grid legible as a grid - the 12-column structure becomes something you
          can see rather than something implied by invisible column widths, which
          is the "precision grid" cue the design direction asks for. It is one
          1px line and it is the only structural rule on the page.
        */}
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-0">
          <div className="flex flex-col gap-6 lg:col-span-7 lg:pr-12">
            {/*
              Eyebrow. Says what the business does in four words, before the
              headline, so a visitor scanning only the first line still gets the
              category. `text-fg-accent` is the scheme-aware accent token, so it
              stays legible in both light and dark.

              Step 6: the local `tracking-[0.08em]` and `font-semibold` overrides
              are gone. The token now carries 0.16em and weight 600, and the hero
              was overriding the tracking back down to 0.08em - which, after the
              token change, would have made the hero eyebrow visibly tighter than
              the services eyebrow directly below it. Two eyebrows on one page
              with different letterspacing is the kind of thing that reads as
              "cheap" without being traceable to any single decision.
            */}
            <p className={`${rise(0)} flex items-center gap-2.5 text-label text-fg-accent uppercase`}>
              {/*
                A short rule rather than a bullet. It reads as a divider between
                the header and the headline, which is what an eyebrow is, and it
                costs no layout shift.

                Step 6: `accent-400` rather than `accent-500`. On near-black the
                mid brass sat too close to the background to read as a drawn
                line; the lighter step separates cleanly without the accent
                starting to compete with the button below it.
              */}
              <span aria-hidden="true" className="h-px w-8 bg-accent-400" />
              Vehicle sales &amp; international export
            </p>

            {/*
              The single `h1` on the page.

              "Buy and export vehicles from Dubai" is chosen over a more emotive
              headline because it is the plainest description of what actually
              happens here, and it names the two things a visitor came for. The
              rest of the copy supplies the reason to believe.

              `text-balance` on the headline and the paragraph keeps ragged
              right edges from appearing at intermediate widths, which is where a
              fluid clamp like `text-display` usually looks worst.

              Step 6: measure widened 18ch -> 20ch to keep pace with the larger
              display cap. At 18ch the headline broke into three short lines with
              a stranded "Dubai"; the wider measure lets `text-balance` produce
              two fuller lines, which is what gives the headline its weight.
            */}
            <h1
              id="hero-heading"
              className={`${rise(1)} max-w-[20ch] text-balance text-display text-fg`}
            >
              Buy and export vehicles from Dubai
            </h1>

            <p
              className={`${rise(2)} max-w-[52ch] text-pretty text-body-lg text-fg-secondary`}
            >
              Humera Automobile is a Dubai-based vehicle sales and international export
              business. Visit our showroom in Ras Al Khor, or tell us the make and model
              you are looking for and we will source it.
            </p>

            {/*
              CTA row.

              `flex-col` on the smallest screens with full-width buttons, then a
              row from `sm` up. Stacking is not a compromise here - two 48px
              buttons plus a gap is 112px, which is a third of a small phone's
              viewport, and side-by-side they would either wrap awkwardly or
              truncate their labels.

              `sm:flex-row` rather than `flex-row` from the start: below 640px
              there is not enough width for "Enquire on WhatsApp" and
              "What we source" to sit on one line without shrinking below the
              44px tap minimum.
            */}
            <div className={`${rise(3)} flex flex-col gap-3 pt-2 sm:flex-row sm:items-center`}>
              {/*
                `unavailable="disabled"` is the important prop here.

                The default is `"hidden"`, which renders nothing - correct for the
                header and the drawer, where a dead "Contact" button in a nav bar
                looks broken. This page is *about* getting an enquiry, so a
                missing primary button would read as an oversight rather than as
                absence. Disabled makes the gap legible and honest: it is
                announced as unavailable, has no `href`, and cannot be activated.
              */}
              <WhatsAppCta
                label="Enquire on WhatsApp"
                ariaLabel="Enquire on WhatsApp"
                variant="accent"
                size="lg"
                unavailable="disabled"
                className="w-full sm:w-auto"
              />

              {/*
                A plain `<a>`, not `next/link`. Two reasons, both of which also
                apply to the WhatsApp CTA: an in-page fragment is not a route, and
                `next/link` would try to client-side navigate to a destination
                that is already on the page. `actionClasses` is the button recipe,
                so the two CTAs cannot drift apart visually.
              */}
              <a href="#services" className={actionClasses("outline", "lg", "w-full sm:w-auto")}>
                What we source &amp; export
              </a>
            </div>

            {/*
              A single verifiable trust signal: a real, physical location.

              This is the one piece of social proof the repository can actually
              support, and it is worth more than a row of invented counters -
              a showroom address is checkable, and it is the thing an importer
              genuinely wants to know before enquiring. Sourced from
              `config/site.ts` rather than restated, so it cannot drift from the
              footer.
            */}
            <p
              className={`${rise(3)} flex items-start gap-2.5 pt-2 text-body-sm text-fg-muted`}
            >
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 shrink-0 rounded-pill bg-accent-400"
              />
              <span>
                Showroom: <span className="text-fg-secondary">{SHOWROOM_ADDRESS_ONE_LINE}</span>
              </span>
            </p>
          </div>

{/*
             The hero slider column — replaces the static SVG artwork with a
             professional image carousel. On mobile it stacks below the copy;
             on lg+ it sits alongside it with a hairline divider.
           */}
           <div className="mx-auto w-full max-w-[26rem] lg:col-span-5 lg:max-w-none lg:border-l lg:border-line lg:pl-12">
             <HeroSlider className="h-full" />
           </div>
        </div>
      </Container>
    </section>
  );
}
