"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Hero slide data shape. In the future this comes from `/api/hero-slides`;
 * for now we seed dummy images so the slider works without any database.
 */
export interface HeroSlide {
  id: string;
  imageUrl: string;
  alt: string;
  /** Optional CTA; if present, the whole slide becomes a link */
  href?: string;
  /** Optional label for the CTA (used when href is present) */
  ctaLabel?: string;
}

/**
 * The hero slides.
 *
 * ---------------------------------------------------------------------------
 * Where these images came from
 * ---------------------------------------------------------------------------
 * Real photography of the dealership's own stock, taken in the Ras Al Khor yard -
 * the same three photographs the previous website showed in its hero carousel,
 * pulled from that site's own uploads and committed here.
 *
 * They live in `public/hero/` and are referenced as site-relative paths rather than
 * hosted elsewhere. Three reasons, in order of importance:
 *
 *   1. A remote `src` means every visitor's browser fetches from a third-party
 *      host - slower, and it breaks the moment that host moves a file. It also
 *      requires that host in `next.config.ts`'s `remotePatterns`, which widens the
 *      image optimiser's allow-list for every image on the site.
 *   2. `next/image` cannot optimise a source it does not control at build time, so
 *      a remote hero photograph ships at whatever resolution it was uploaded at
 *      and is never re-encoded to AVIF/WebP. A local file gets the same treatment
 *      as every other image in the project.
 *   3. Once vehicles exist in the database these same files should be uploaded
 *      through the staff vehicle manager and served from the API's media route.
 *      That is the long-term home for vehicle photography, and a `public/` asset
 *      is the right interim: it is real photography now, and it has somewhere
 *      sensible to move to.
 *
 * ---------------------------------------------------------------------------
 * Alt text
 * ---------------------------------------------------------------------------
 * Written as what a sighted reader takes from the photograph - the car, its
 * colour, the view. There is no adjacent heading here to duplicate, which is why
 * this differs from the vehicle cards, where the title sits directly beneath the
 * image and the image's alt is deliberately empty.
 */
const HERO_SLIDES: HeroSlide[] = [
  {
    id: "hero-g-class",
    imageUrl: "/hero/hero-slide-1.jpg",
    alt: "A bright green Mercedes-Benz G-Class photographed from the front three-quarter angle in the dealership yard",
  },
  {
    id: "hero-lexus-lx",
    imageUrl: "/hero/hero-slide-2.jpg",
    alt: "A white Lexus LX 600 photographed from the front three-quarter angle in the dealership yard",
  },
  {
    id: "hero-land-cruiser",
    imageUrl: "/hero/hero-slide-3.jpg",
    alt: "A yellow Toyota Land Cruiser Prado photographed from the front three-quarter angle in the dealership yard",
  },
];

/** What the caller can change about the slider's behaviour. */
interface SliderConfig {
  /** Milliseconds between automatic advances. `0` disables autoplay entirely. */
  autoplayInterval: number;
  /** Hold the autoplay while the pointer or focus is inside the slider. */
  pauseOnHover: boolean;
  /** Show the previous/next arrows. */
  showArrows: boolean;
  /** Show the dot indicators. */
  showDots: boolean;
}

/**
 * Default slider behaviour.
 *
 * The 5000ms interval and 700ms transition are the values the previous site's
 * carousel ran at, read from its own configuration, so the new slider has the same
 * rhythm rather than merely looking similar.
 *
 * `pauseOnHover` is the one deliberate difference. The old carousel did not pause,
 * which meant a visitor who had rested the pointer on a photograph to read it had
 * it pulled out from under them mid-sentence. It is worth the deviation, and it is
 * also what WCAG 2.2.2 asks for: anything that moves automatically for more than
 * five seconds needs a way to pause it, and hover is that way.
 *
 * There is a second, stronger one: `prefers-reduced-motion` disables autoplay
 * entirely. See the effect in this component.
 */
const DEFAULT_CONFIG: SliderConfig = {
  autoplayInterval: 5000,
  pauseOnHover: true,
  showArrows: true,
  showDots: true,
};

interface HeroSliderProps {
  /** Slides to display. If omitted, falls back to dummy images. */
  slides?: HeroSlide[];
  /** Override default slider behaviour */
  config?: Partial<SliderConfig>;
  /** Additional className for the slider wrapper */
  className?: string;
}

/**
 * Professional image slider for the hero section.
 *
 * Features:
 * - Auto-advance every 3s (configurable), pauses on hover/focus
 * - Smooth cross-fade transition with CSS animations
 * - Keyboard navigation (←/→ arrows)
 * - Dot indicators + arrow buttons
 * - Respects `prefers-reduced-motion` (disables auto-advance & transitions)
 * - Accessible: ARIA live region for slide announcements, proper roles
 * - Server/Client boundary clean: parent fetches data, this is pure client
 */
export function HeroSlider({
  slides = HERO_SLIDES,
  config = {},
  className,
}: HeroSliderProps) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });
  const autoplayRef = useRef<number | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Listen for reduced-motion preference changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Autoplay logic
  useEffect(() => {
    if (cfg.autoplayInterval === 0 || prefersReducedMotion) return;
    autoplayRef.current = window.setInterval(() => {
      if (!isHovered) {
        setCurrentIndex((i) => (i + 1) % slides.length);
      }
    }, cfg.autoplayInterval);
    return () => {
      if (autoplayRef.current) window.clearInterval(autoplayRef.current);
    };
  }, [cfg.autoplayInterval, isHovered, prefersReducedMotion, slides.length]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setCurrentIndex((i) => (i - 1 + slides.length) % slides.length);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setCurrentIndex((i) => (i + 1) % slides.length);
      }
    },
    [slides.length]
  );

  const goToSlide = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  const currentSlide = slides[currentIndex];

  return (
    <div
      ref={sliderRef}
      className={cn("relative overflow-hidden", className)}
      onMouseEnter={() => cfg.pauseOnHover && setIsHovered(true)}
      onMouseLeave={() => cfg.pauseOnHover && setIsHovered(false)}
      onFocusCapture={() => cfg.pauseOnHover && setIsHovered(true)}
      onBlurCapture={() => cfg.pauseOnHover && setIsHovered(false)}
      onKeyDown={handleKeyDown}
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured vehicles"
    >
      {/* Live region for screen-reader slide announcements */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        Slide {currentIndex + 1} of {slides.length}: {currentSlide.alt}
      </div>

      {/*
        Slide container.

        `h-full` rather than an aspect ratio. It used to carry
        `aspect-[16/9] md:aspect-[21/9] lg:aspect-[2.4/1]`, which sized the frame
        from its width - correct while the component decided its own height, and
        wrong once the hero gave it a fixed `h-[90vh]`. An aspect box inside a
        fixed-height parent is a contradiction: the box computed a height from the
        width, overflowed the 90vh, and the hero grew a scrollbar. The height now
        comes from the hero and each image fits itself into whatever shape that
        produces - see the note on `object-cover` in `SlideImage`.

        `bg-sunken` is now only a placeholder, not a pillarbox. The photographs
        were cropped to 16:9 to match this frame, so the image reaches the edges
        and there is nothing showing through. It is still the colour behind the
        photograph while it decodes, which is why it is the darkest step.

        The consequence is that the frame's aspect ratio is now the viewport's
        rather than a designed one. That is the right trade for a full-bleed hero:
        `object-cover` crops rather than letterboxes, so there is never a black
        bar inside the image, and a portrait phone gets a portrait crop of a
        landscape photograph - which is a better result than a 16:9 box with empty
        space either side of it.
      */}
      <div className="relative h-full w-full bg-sunken">
        {slides.map((slide, index) => (
          <HeroSlideImage
            key={slide.id}
            slide={slide}
            isActive={index === currentIndex}
            prefersReducedMotion={prefersReducedMotion}
          />
        ))}

        {/* Navigation arrows — full-width flex wrapper ensures left/right separation */}
        {cfg.showArrows && slides.length > 1 && (
          <div className="absolute inset-0 flex items-center justify-between px-4 md:px-6 pointer-events-none">
            <SlideArrowButton
              onClick={() => goToSlide((currentIndex - 1 + slides.length) % slides.length)}
              aria-label="Previous slide"
            >
              <ArrowLeft className="h-6 w-6" aria-hidden="true" />
            </SlideArrowButton>
            <SlideArrowButton
              onClick={() => goToSlide((currentIndex + 1) % slides.length)}
              aria-label="Next slide"
            >
              <ArrowRight className="h-6 w-6" aria-hidden="true" />
            </SlideArrowButton>
          </div>
        )}
      </div>

      {/* Dot indicators */}
      {cfg.showDots && slides.length > 1 && (
        <div
          className="absolute inset-x-0 bottom-6 z-20 flex items-center justify-center gap-2 md:bottom-8"
          role="tablist"
          aria-label="Slide indicators"
        >
          {slides.map((_, index) => (
            <button
              key={slides[index].id}
              role="tab"
              aria-selected={index === currentIndex}
              aria-label={`Go to slide ${index + 1}: ${slides[index].alt}`}
              onClick={() => goToSlide(index)}
              // A dot is a target, so it needs a target-sized hit area. 8px of dot
              // in a 44px button: the visible mark stays small and the button
              // carries the affordance.
              className="group/dot flex size-11 items-center justify-center"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "block h-2 rounded-full transition-all duration-[var(--duration-base)] ease-[var(--ease-standard)]",
                  index === currentIndex
                    ? "w-7 bg-accent-500 shadow-[0_0_12px_rgb(224_16_35/0.8)]"
                    : "w-2 bg-fg-inverse/40 group-hover/dot:bg-fg-inverse/70",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Individual slide image with cross-fade animation.
 * Uses `animate-fade-in` from the design system for the active slide.
 */
function HeroSlideImage({
  slide,
  isActive,
  prefersReducedMotion,
}: {
  slide: HeroSlide;
  isActive: boolean;
  prefersReducedMotion: boolean;
}) {
  return (
    <div
      className={cn(
        // The cross-fade. 700ms is the transition speed the previous site's carousel
        // ran at, and it is slow enough to read as a dissolve rather than a cut.
        // `ease-out-soft` decelerates into the incoming slide so it arrives rather
        // than stopping.
        "absolute inset-0 transition-opacity duration-700 ease-out-soft",
        isActive ? "z-10 opacity-100" : "pointer-events-none z-0 opacity-0",
        prefersReducedMotion && "transition-none",
      )}
      aria-hidden={!isActive}
    >
      {slide.href ? (
        <a
          href={slide.href}
          className="block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          aria-label={slide.ctaLabel ?? slide.alt}
        >
          <SlideImage src={slide.imageUrl} alt={slide.alt} />
        </a>
      ) : (
        <SlideImage src={slide.imageUrl} alt={slide.alt} />
      )}
      {slide.ctaLabel && slide.href && (
        <div className="absolute inset-x-0 bottom-20 px-6 md:bottom-24 md:left-24 md:right-auto md:px-0">
          <a href={slide.href} className="inline-flex w-full items-center md:w-auto">
            <Button variant="accent" size="lg" className="w-full animate-fade-up md:w-auto">
              {slide.ctaLabel}
            </Button>
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * The slide photograph.
 *
 * `next/image` with `fill`, not a plain `<img>`.
 *
 * This was a plain `<img>` for as long as the slides pointed at remote
 * placeholders, and that was a reasonable trade then: `next/image` cannot
 * optimise a source it does not control, so it would have fetched the full remote
 * file anyway and added a round trip through this server for nothing. The cost was
 * that the hero shipped unoptimised - 315KB of JPEG on the LCP element, never
 * re-encoded to AVIF or WebP - which is the warning `eslint` has been reporting
 * on this line throughout.
 *
 * With local files that reasoning inverts. The optimiser now has everything it
 * needs: it re-encodes to AVIF/WebP, serves a width-appropriate source per
 * breakpoint, and a phone stops downloading a 1600x1200 photograph it will never
 * use. That is the difference between a ~40KB and a ~315KB hero on mobile.
 */
function SlideImage({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      // Tells the optimiser how wide the image is rendered, so it can pick a
      // source size. The hero is full-bleed: 100vw on a phone, close to the
      // viewport width everywhere else.
      sizes="100vw"
      // The hero is the Largest Contentful Paint element, so it must not be lazy.
      // `priority` also stops Next warning that the LCP image is lazy-loaded.
      priority
      // `object-cover` - the image fills the frame, and nothing is cropped.
      //
      // This is only correct because the photographs were cropped to 16:9 by
      // `scripts/crop_hero_to_widescreen.py`, which is what made the fit mode a
      // choice rather than a compromise. At 4:3 in a ~16:9 frame the two options
      // were both bad: `cover` scaled the image to 133% of the frame's height and
      // cut a quarter of every photo away - the over-cropped car - while
      // `contain` showed the whole car but left the sides of the frame empty.
      //
      // At 1600x900 the photo's ratio now matches the frame's, so `cover` has
      // nothing to crop: it fills the full width and shows the entire photograph.
      // A 1440px-wide viewport at 90vh is exactly 16:9, so on the most common
      // desktop the fit is pixel-exact.
      //
      // On a wider or shorter viewport a little height is trimmed rather than the
      // sides - the correct thing to lose, because the sides of these photographs
      // are the car's front and rear wings.
      className="object-cover"
      style={{
        // A gradient of two *surfaces*, not of two hues, so it cannot shift the
        // perceived colour of the image that replaces it - and on the black canvas
        // it is nearly black, which is what the empty sides of the frame will be
        // while the photograph decodes. It is also what keeps those sides from
        // being dead black during load.
        backgroundImage: `linear-gradient(135deg, var(--surface-sunken) 0%, var(--surface-raised) 100%)`,
      }}
    />
  );
}

/**
 * Arrow button styled for overlay use.
 *
 * Sits directly on photography, so it cannot rely on a surface token for its
 * fill: the backdrop is whatever the photograph is, and no token survives both a
 * white sky and a black studio. It therefore uses a translucent black plate and
 * near-white type, which is legible on every photograph, and picks up the brand
 * red as a border on hover so it still belongs to the palette.
 *
 * It is a real 48px circle rather than a small chevron on a transparent hit area,
 * because it is a touch target on a phone as well as a pointer target on a
 * desktop.
 */
function SlideArrowButton({
  children,
  onClick,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  "aria-label": string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="md"
      className={cn(
        "pointer-events-auto flex size-12 items-center justify-center rounded-full",
        "border border-fg-inverse/20 bg-black/40 text-fg-inverse backdrop-blur-md",
        "transition-[background-color,border-color,transform,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-standard)]",
        "hover:-translate-y-0.5 hover:border-accent-500 hover:bg-black/60 hover:shadow-[var(--shadow-glow-red)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        "[&>svg]:size-6",
      )}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </Button>
  );
}