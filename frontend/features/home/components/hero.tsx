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
      className="on-inverse relative overflow-hidden bg-page w-full h-[90vh]"
    >
      <HeroSlider className="w-full h-full" />
    </section>
  );
}