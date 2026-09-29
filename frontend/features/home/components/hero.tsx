import { Container } from "@/components/ui/container";
import { HeroSlider } from "@/features/home/components/hero-slider";

/**
 * Homepage hero — full-screen image slider.
 *
 * A Server Component that renders the client-side slider. No copy, no CTAs,
 * no secondary actions — the slider *is* the hero.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="on-inverse relative overflow-hidden bg-page min-h-[80vh] lg:min-h-[90vh]"
    >
      {/*
        Step 6: a single soft lift behind the slider rather than the previous wash.
        On the light canvas this was a near-white ellipse fading into near-white,
        which read as a slightly dirty patch rather than as depth. Drawn from
        `--surface-raised` (one step above the base) it now behaves like a
        spotlight: the slider sits in the brightest part of the canvas.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(ellipse_58%_52%_at_38%_0%,var(--surface-raised),transparent)]"
      />

      <Container className="h-full flex items-center justify-center">
        <HeroSlider className="w-full max-w-[1400px]" />
      </Container>
    </section>
  );
}