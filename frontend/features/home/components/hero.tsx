import Link from "next/link";

import { HeroSlider } from "@/features/home/components/hero-slider";
import { buttonClasses } from "@/components/ui/button-styles";

/**
 * Homepage hero — full-bleed image slider with a professional bottom-anchored
 * content panel.
 *
 * ---------------------------------------------------------------------------
 * Layout philosophy — why the copy sits at the bottom
 * ---------------------------------------------------------------------------
 * The previous version overlaid the nameplate directly on the car photography,
 * obscuring the vehicles and reading as cluttered. The reference points are
 * Ferrari.com, Lamborghini.com and BMW configurators — none of which put text
 * over the car itself.
 *
 * The professional treatment is a bottom-anchored panel:
 *   - The full car is visible, unobstructed, in the upper frame
 *   - A semi-transparent frosted bar sits at the bottom, inside the gradient
 *   - Copy and CTAs live in this bar, which has guaranteed contrast
 *   - The gradient transitions the photography into the panel naturally
 *
 * ---------------------------------------------------------------------------
 * Why the panel uses backdrop-blur rather than a solid fill
 * ---------------------------------------------------------------------------
 * A hard-edged opaque panel reads as a separate element glued onto the photo.
 * Backdrop-blur lets the image continue to be felt beneath the copy while
 * providing the contrast needed for white text. It is the same treatment used
 * in iOS, macOS, and every modern luxury automotive brand site.
 *
 * ---------------------------------------------------------------------------
 * CTA strategy
 * ---------------------------------------------------------------------------
 * Two buttons: a primary gold/accent "Browse Inventory" and a secondary
 * "Enquire" outline. The primary drives the conversion funnel; the secondary
 * is for visitors who want to talk before browsing. Having both lets each
 * visitor type find their path without scrolling.
 */

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative w-full overflow-hidden bg-page"
    >
      {/* ── Depth layers ─────────────────────────────────────────────────── */}

      {/* Top vignette — darkens the sky/background so the car reads against
          the header without needing a hard edge between them. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-36 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.65),transparent)]"
      />

      {/* Bottom gradient — transitions the photography into the panel.
          The blur and the gradient together are what make the join seamless. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-56 bg-[linear-gradient(to_top,rgb(0_0_0/0.92)_0%,rgb(0_0_0/0.70)_45%,transparent_100%)]"
      />

      {/* Subtle gold ambient glow — warms the photography without tinting it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_70%_40%_at_50%_110%,color-mix(in_oklab,var(--color-gold-700)_9%,transparent),transparent_70%)]"
      />

      {/* ── The photograph ───────────────────────────────────────────────── */}
      <div className="relative z-[2] h-[72vh] min-h-[34rem] sm:h-[80vh] lg:h-[88vh] xl:h-[90vh]">
        <HeroSlider className="h-full w-full" />

        {/* ── Content panel ──────────────────────────────────────────────── */}
        {/*
          Positioned at the absolute bottom of the slider frame.
          pointer-events-auto on the inner div restores clicks for the buttons;
          the outer wrapper is pointer-events-none so it never blocks the
          slider's arrow and dot controls.
        */}
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-end">
          <div className="pointer-events-auto w-full px-6 pb-8 sm:px-10 sm:pb-10 lg:px-16 lg:pb-12 xl:px-24 xl:pb-14">

            {/* ── Eyebrow ────────────────────────────────────────────────── */}
            {/* Location tag — reads as a caption, not a headline */}
            <p className="animate-fade-up mb-4 flex items-center gap-3 [animation-delay:80ms]">
              <span
                aria-hidden="true"
                className="block h-px w-10 bg-[linear-gradient(90deg,var(--color-gold-400),transparent)]"
              />
              <span className="text-[0.625rem] font-semibold tracking-[0.22em] uppercase" style={{ color: "var(--color-gold-400)" }}>
                Dubai, UAE · Est. 2014
              </span>
            </p>

            {/* ── Name + tagline ─────────────────────────────────────────── */}
            <div className="mb-6 flex flex-col gap-2 lg:mb-8">
              <h1
                id="hero-heading"
                className="animate-fade-up text-[clamp(2rem,5vw,3.75rem)] font-bold leading-[1.0] tracking-[-0.03em] text-white uppercase [animation-delay:140ms]"
              >
                Humera{" "}
                <span style={{ color: "var(--color-gold-300)" }}>Automobile</span>
              </h1>
              <p className="animate-fade-up max-w-[48ch] text-[0.9375rem] leading-relaxed text-white/65 [animation-delay:200ms]">
                Premium vehicles. Showroom in Dubai — sourced, inspected and exported worldwide.
              </p>
            </div>

            {/* ── Divider + stats + CTAs ─────────────────────────────────── */}
            {/*
              All in one horizontal row on desktop, stacked on mobile.
              The divider visually separates the nameplate from the action zone.
            */}
            <div className="animate-fade-up flex flex-col gap-6 [animation-delay:280ms] lg:flex-row lg:items-center lg:gap-10">

              {/* Stat strip */}
              <div className="flex items-center gap-6 sm:gap-8">
                {[
                  { value: "500+", label: "Vehicles" },
                  { value: "50+",  label: "Countries" },
                  { value: "10+",  label: "Years" },
                ].map(({ value, label }, i) => (
                  <div key={i} className="flex flex-col gap-0.5">
                    <span className="text-[1.5rem] font-bold leading-none tracking-tight text-white tnum">
                      {value}
                    </span>
                    <span className="text-[0.625rem] font-semibold tracking-[0.14em] text-white/45 uppercase">
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Vertical divider (desktop only) */}
              <span
                aria-hidden="true"
                className="hidden h-10 w-px shrink-0 bg-white/15 lg:block"
              />

              {/* CTA buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/inventory"
                  className={buttonClasses("accent", "lg", "shrink-0")}
                >
                  Browse Inventory
                </Link>
                <Link
                  href="/contact"
                  className={buttonClasses("outline", "lg", "shrink-0 border-white/30 text-white hover:border-gold-400 hover:text-gold-300")}
                >
                  Enquire Now
                </Link>
              </div>
            </div>

          </div>
        </div>

        {/* ── Slide position indicator ───────────────────────────────────── */}
        {/*
          A thin gold progress line at the very bottom edge of the hero,
          replacing the dot indicators inside the slider with something that
          reads as part of the page rather than a UI control.
          This is a decorative element only — the slider's own dots and arrows
          remain the interactive controls.
        */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 z-30 h-px bg-[linear-gradient(90deg,transparent_0%,var(--color-gold-600)_15%,var(--color-gold-300)_50%,var(--color-gold-600)_85%,transparent_100%)] opacity-60"
        />
      </div>
    </section>
  );
}
