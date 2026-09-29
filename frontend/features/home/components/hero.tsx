import { HeroSlider } from "@/features/home/components/hero-slider";

/**
 * Homepage hero — full-bleed image slider.
 *
 * A Server Component that renders the client-side slider. No copy, no CTAs, no
 * secondary actions — the slider *is* the hero.
 *
 * ---------------------------------------------------------------------------
 * Why `aria-labelledby` points at an element that is not here
 * ---------------------------------------------------------------------------
 * The slider announces itself as a labelled carousel region in its own right
 * (`aria-roledescription="carousel"` plus a label), so this section does not need
 * a visible heading to be named. The `id` stays so the association does not rot if
 * a heading is ever added back: a reference to a missing id is dropped silently by
 * assistive technology, which is the sort of thing that goes unnoticed until
 * someone audits it.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative w-full overflow-hidden bg-page"
    >
      {/*
        The red ambient wash behind the photography.

        The slider is full-bleed, so this is only visible where an image does not
        cover the frame - the letterbox on a wide desktop, the edges on a phone.
        Without it those gaps are pure black and the hero looks like a broken
        embed rather than a deliberate dark canvas. `aria-hidden` because it is
        lighting, and lighting carries no information.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_55%_45%_at_50%_100%,color-mix(in_oklab,var(--color-accent-500)_14%,transparent),transparent_70%)]"
      />

      {/*
        The top and bottom scrims. Photographs are unpredictable - a pale sky
        shot and a dark studio shot both land here - and the slider's own controls
        and dot indicators sit directly on the image. Black at partial opacity is
        the one scrim that stays legible against either.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.7),transparent)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-[linear-gradient(to_top,rgb(0_0_0/0.75),transparent)]"
      />

      <div className="relative z-20 h-[90vh]">
        <HeroSlider className="h-full w-full" />
      </div>
    </section>
  );
}