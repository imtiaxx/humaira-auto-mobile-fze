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
 * left-to-right page, so the business name is the first thing read. The scrim is
 * weighted to match, so the words get the clean surface and the photograph is
 * still seen in full colour on the side they are not over.
 *
 * ---------------------------------------------------------------------------
 * Why the scrim is light
 * ---------------------------------------------------------------------------
 * The copy is red and black type, so the surface behind it has to be light. That
 * single constraint is what forces the light panel, and it is worth being explicit
 * about because it reads at first like a strange choice for a dark-themed site.
 *
 * The alternative was rejected on measurement, not taste. The previous iteration
 * held 0.85-0.93 black across the copy's column so that white type would clear
 * AA. Underneath that scrim, `#0d0d0f` body text lands at roughly 1:1 - the
 * subtitle would have been technically present and completely unreadable, and no
 * automated check would have caught it, because `scripts/check-contrast.mjs` audits
 * token pairings and never looks at a photograph.
 *
 * Inverting the panel to near-white also *improved* the headline. The brand red
 * `#c00d1e` measures about 6:1 against a near-white surface, comfortably clearing
 * AA as body text. The same red on the dark scrim would have measured 3.9:1 -
 * technically legal for large text only, and nothing like as strong.
 *
 * So the light panel is not a concession to the black subtitle; it is the surface
 * that lets both instructions hold at once. The dark theme is untouched everywhere
 * else on the page, and the panel itself is a raw ramp token rather than a semantic
 * one precisely so it cannot leak into the rest of the design system.
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
        className="pointer-events-none absolute inset-0 z-20 hidden bg-[linear-gradient(to_right,rgb(250_250_250/0.98)_0%,rgb(250_250_250/0.97)_36%,rgb(250_250_250/0.9)_52%,rgb(250_250_250/0.4)_72%,transparent_90%)] lg:block"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-20 bg-[linear-gradient(to_top,rgb(250_250_250/0.98)_0%,rgb(250_250_250/0.95)_34%,rgb(250_250_250/0.72)_58%,transparent_84%)] lg:hidden"
      />

      <div className="relative z-20 h-[90vh]">
        <HeroSlider className="h-full w-full" />

        {/*
          The statement.

          `pointer-events-none` on the wrapper so it can never intercept a click on
          the slider's arrows or dots underneath. It does not affect the
          accessibility tree - screen readers still read the heading and the
          paragraph in order - so nothing is lost by it.

          `lg:pl-24` keeps the copy clear of the left-hand arrow, which sits at
          `left-6` and is 48px wide.
        */}
        <div className="pointer-events-none absolute inset-0 z-30 flex items-end justify-center px-6 pb-24 sm:px-10 sm:pb-28 lg:items-center lg:justify-start lg:px-0 lg:pb-0 lg:pl-24 xl:pl-32">
          <div className="flex max-w-[34rem] flex-col gap-3 text-center lg:items-start lg:pr-6 lg:text-left">
            {/*
              The business name, in the brand red.

              `accent-600` rather than `accent-500` and rather than the semantic
              `text-fg-accent`, and the reason is contrast in both directions:

                - `text-fg-accent` is `accent-300`, a pale red. It is correct for
                  red type on the *dark* canvas, where it measures 8.7:1 - but on
                  this light panel it would be a washed-out pink.
                - `accent-500` is the vivid marque red at 4.9:1 on near-white.
                  That clears AA, and it is the colour the brand actually uses.
                - `accent-600` is a step deeper still, at roughly 6:1 on this
                  panel, and it holds that ratio against the photograph's brighter
                  areas bleeding through the gradient's release.

              A raw ramp token rather than a semantic one, which this design system
              otherwise insists on. It is the correct exception here: the semantic
              layer is built for a dark canvas, and a light panel is a one-off
              surface with no other component on it. Re-theming every semantic
              token to accommodate a single hero headline would be the wrong fix.

              Uppercase with tight tracking, because that is the automotive marque
              convention and it is what makes a business name read as a nameplate
              rather than a sentence. The size is deliberately below the design
              system's `text-display` cap: at 72px this three-word name would
              break to three ragged lines inside a third of the viewport, and a
              broken headline reads as an accident.
            */}
            <h1
              id="hero-heading"
              className="animate-fade-up text-balance text-[clamp(2rem,5.2vw,3.5rem)] leading-[1.05] font-semibold tracking-[-0.02em] text-accent-600 uppercase [animation-delay:150ms]"
            >
              Humera Automobile Cars
            </h1>

            {/*
              The supporting line, in black.

              `ink-950` is the darkest step of the neutral ramp - effectively true
              black, and about 18:1 on this panel. It is a raw ramp token for the
              same reason as the red above: the semantic `--text-primary` is
              near-white, because the semantic layer assumes the dark canvas this
              panel deliberately inverts.
            */}
            <p className="animate-fade-up max-w-[34ch] text-pretty text-body-lg text-ink-950 [animation-delay:260ms]">
              Quality vehicles, ready for the road.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
