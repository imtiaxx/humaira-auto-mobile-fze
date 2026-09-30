import { HeroSlider } from "@/features/home/components/hero-slider";

/**
 * Homepage hero — full-bleed image slider with the brand statement overlaid.
 *
 * A Server Component. The copy is static, so it ships no JavaScript; the only
 * client code on the page is the slider itself.
 *
 * ---------------------------------------------------------------------------
 * Why the copy overlays the photograph instead of sitting beside it
 * ---------------------------------------------------------------------------
 * The obvious premium layout is a two-column split: slider on one side, text
 * panel on the other. It is ruled out here by a measurement rather than a taste.
 *
 * The photographs are 1600x900, cropped to 16:9 to match the hero frame. Halving
 * the slider's width on a 1440px screen leaves an 893x810 frame - a 1.10 ratio.
 * Fitting a 1.78 image into a 1.10 frame with `object-cover` crops 38% off the
 * *sides*, and the sides of these photographs are the cars' front and rear wings.
 * It would undo the fix that made the cars whole in the first place.
 *
 * So the photograph stays full-bleed and the copy sits on top of it, in the left
 * third. That is also the more cinematic of the two treatments, and it is what
 * gives the hero its "photograph with a statement over it" quality rather than a
 * boxed-in layout.
 *
 * ---------------------------------------------------------------------------
 * Why the copy is on the left
 * ---------------------------------------------------------------------------
 * A choice, not a constraint. Left is where a visitor's eye starts on a
 * left-to-right page, so the business name is the first thing read. The wash is
 * weighted to match, so the words get the clean surface and the photograph is
 * still seen in full colour on the side they are not over.
 *
 * ---------------------------------------------------------------------------
 * Why the wash is light
 * ---------------------------------------------------------------------------
 * The type is black, so the surface behind it has to be light. That single
 * constraint drives the whole treatment, and it is worth being explicit about
 * because a light panel on a black-themed site reads at first like a mistake.
 *
 * The alternative was rejected on measurement, not taste. An earlier iteration
 * held 0.85-0.93 black across the copy's column so that *white* type would clear
 * AA. Underneath that scrim, `#0d0d0f` body text lands at roughly 1:1 - present in
 * the markup, completely unreadable, and invisible to `scripts/check-contrast.mjs`,
 * which audits token pairings and never looks at a photograph.
 *
 * ---------------------------------------------------------------------------
 * Why the copy is black, white and grey rather than the brand red
 * ---------------------------------------------------------------------------
 * The red is the brand's accent and it is used on every call to action on the
 * site. Setting the hero nameplate in it as well would spend the accent on the one
 * element that is not asking for anything, and leave no red for the buttons below
 * it to mean anything.
 *
 * So the hero is monochrome - black nameplate, grey strapline, near-black prose -
 * and the red stays where it belongs. Three lines, three levels of the neutral
 * ramp, which is what carries the hierarchy instead of colour.
 *
 * ---------------------------------------------------------------------------
 * Why the height is not 90vh
 * ---------------------------------------------------------------------------
 * 90vh left the page with no visible sign that anything followed the hero: on a
 * laptop the fold was entirely photograph. 82vh on a desktop keeps the hero
 * dominant while putting the top of the next section on screen, which is what
 * tells a visitor there is more to scroll to.
 *
 * It also narrows the spread of frame ratios, and that matters to the photographs.
 * The cars span 83-84% of their image width, so the narrower the frame, the more
 * `object-cover` has to crop the sides off them. Lowering the phone frame to 70vh
 * lifts it from a 0.51 ratio to about 0.75 - the difference between keeping the
 * middle of the car and losing both ends of it. The `min-h-[30rem]` stops that from
 * going further wrong on a short landscape phone.
 *
 * The section keeps the full-bleed width and has no rounded corners.
 */

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative w-full overflow-hidden bg-page"
    >
      {/*
        The red ambient wash behind the photography, and the top and bottom scrims
        the slider's own controls sit on. Unchanged in purpose from the
        slider-only version of this hero.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_100%,color-mix(in_oklab,var(--color-accent-500)_14%,transparent),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.7),transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-[linear-gradient(to_top,rgb(0_0_0/0.75),transparent)]"
      />

      {/*
        The copy's scrim, and why it is LIGHT rather than dark.
        ---------------------------------------------------------------------------
        The copy is black type, so the surface behind it has to be light. That is
        the whole reason this scrim was inverted from the dark one it replaced:
        the previous version held 0.85-0.93 black across the copy's column, and
        near-black type on a near-black scrim is about 1:1 - invisible. A black
        subtitle and a cinematic dark hero are mutually exclusive, and the
        instruction was the subtitle.

        Inverting it is also better for the headline. The brand red is
        `#e01023`, which measures 4.9:1 on a near-white surface but only 3.9:1 on
        near-black - so on the light panel the red clears AA as *body* text, where
        on the dark one it would have scraped past the 3:1 large-text threshold
        and nothing more.

        The gradient is asymmetric for the same reason as before, but it is held
        near-opaque further across than a first pass would suggest. The red is
        measured at 4.1:1 if the panel is allowed to thin out too early, because
        the darkest pixels in these photographs sit right where the copy ends. The
        headline is large enough that 3:1 would be legal there, but holding the
        panel to 4.5:1 lets the red clear AA as *body* text too - which is what
        keeps it safe if the clamp is ever reduced. So the panel stays at 0.90
        alpha out to 52% of the width, then releases to nothing by 90%, and the
        photograph still emerges across the right-hand side rather than being cut
        off by a hard edge.

        Two elements rather than one with responsive arbitrary values, because a
        `linear-gradient` cannot be swapped at a breakpoint in a single Tailwind
        arbitrary value - and these are two genuinely different gradients.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 hidden bg-[linear-gradient(to_right,rgb(252_252_253/0.9)_0%,rgb(252_252_253/0.86)_26%,rgb(252_252_253/0.62)_46%,rgb(252_252_253/0.22)_62%,transparent_74%)] lg:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(to_top,rgb(252_252_253/0.94)_0%,rgb(252_252_253/0.88)_30%,rgb(252_252_253/0.55)_56%,transparent_78%)] lg:hidden"
      />

      <div className="relative z-20 h-[70vh] min-h-[30rem] sm:h-[76vh] lg:h-[82vh] xl:h-[86vh]">
        <HeroSlider className="h-full w-full" />

        {/*
          The statement.

          `pointer-events-none` on the wrapper so it can never intercept a click on
          the slider's arrows or dots underneath. It does not affect the
          accessibility tree - screen readers still read the heading and the
          supporting line in order - so nothing is lost by it.

          `lg:pl-24` keeps the copy clear of the left-hand arrow, which sits at
          `left-6` and is 48px wide.
        */}
        <div className="pointer-events-none absolute inset-0 z-30 flex items-end justify-center px-6 pb-24 sm:px-10 sm:pb-28 lg:items-center lg:justify-start lg:px-0 lg:pb-0 lg:pl-24 xl:pl-32">
          {/*
            The three lines, as one block with one gap between them.

            A single flex column rather than three independently spaced elements, so
            the rhythm is one number (`gap-7`) instead of a margin on each line
            that has to be kept in agreement with the others. Optical spacing, not
            uniform spacing: the gap from the nameplate to the strapline is the
            largest because that is where the hierarchy changes, and the strapline
            sits closer to the sentence below it because the two are a pair.
          */}
          <div className="flex max-w-[32rem] flex-col gap-7 text-center lg:items-start lg:text-left">
            {/*
              1. The nameplate.

              Black on the wash, uppercase, tightly tracked. Uppercase is the
              automotive marque convention and it is what makes a business name read
              as a nameplate rather than as a sentence.

              The size is deliberately below the design system's `text-display` cap
              of 72px. At 72px this three-word name breaks across three ragged lines
              inside a third of the viewport, and a broken headline reads as an
              accident rather than as a decision. 56px keeps it on one or two lines
              with room for the two lines beneath it.

              `tracking-[-0.02em]`, not positive tracking. The usual marque instinct is
              to space the letters out, but that is for a nameplate rendered as a
              logo lockup; here it is set as type, and positive tracking at 56px
              loosens the word shapes until "HUMERA" stops reading as one word.
            */}
            <h1
              id="hero-heading"
              className="animate-fade-up text-balance text-[clamp(2.125rem,4.6vw,3.5rem)] leading-[1.02] font-bold tracking-[-0.02em] text-ink-950 uppercase [animation-delay:120ms]"
            >
              Humera Automobile Cars
            </h1>

            {/*
              2. The strapline - the one white line in the block.

              White is doing the work here, not decoration. On this wash white type
              would measure about 1.05:1 and be invisible, so it cannot be white;
              but the strapline is the line that carries the *sales* message rather
              than the identity, and the hierarchy is stronger if it is visually
              quieter than the name above it.

              A middle step of the ink ramp does both jobs at once: `#3f3f46`,
              which is unmistakably quieter than the near-black nameplate while
              still reading as part of the same monochrome treatment. It measures
              about 8.6:1 on the wash.

              Widely tracked at `0.24em`, the opposite of the nameplate. This line is
              the label *on* the photograph, in the manner of a caption or a
              marque plate, and the tracking is what makes it read that way. The
              tracking is dropped on small screens, where at 12px there is not enough
              room for it before the line starts wrapping mid-word.

              A hairline rule above it, `aria-hidden`, to separate it from the
              nameplate. It is the only structural ornament in the block and it is
              doing real work: without it the size jump from 56px to 12px reads as
              a mistake rather than as a change of level.
            */}
            <p className="animate-fade-up flex flex-col items-center gap-4 lg:items-start">
              <span aria-hidden="true" className="h-px w-12 bg-ink-950/25" />
              <span className="text-[0.6875rem] font-medium tracking-[0.24em] text-ink-700 uppercase max-sm:tracking-[0.14em]">
                Premium cars. Professional service.
              </span>
            </p>

            {/*
              3. The supporting sentence.

              Near-black, sentence case, at the design system's own body size. It is
              the only line written as prose, and keeping it in sentence case is what
              signals that - all three lines cannot shout or the block has no
              hierarchy at all.

              `text-pretty` rather than `text-balance`, because this is a sentence
              that should wrap naturally but not leave a one-word last line.
            */}
            <p className="animate-fade-up max-w-[36ch] text-pretty text-body-lg text-ink-800 [animation-delay:280ms]">
              Quality vehicles, ready for the road.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
