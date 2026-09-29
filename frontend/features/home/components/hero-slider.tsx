"use client";

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
 * Dummy slides — replaced by real data once the admin dashboard exists.
 * Uses Unsplash source URLs that serve random vehicle-ish images.
 * These are external but stable enough for development.
 */
const DUMMY_SLIDES: HeroSlide[] = [
  {
    id: "slide-1",
    imageUrl: "https://images.unsplash.com/photo-1544829099-b9a0c5303bea?w=1920&q=80",
    alt: "Modern luxury SUV in showroom lighting",
    ctaLabel: "Explore SUVs",
  },
  {
    id: "slide-2",
    imageUrl: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1920&q=80",
    alt: "Premium sedan on desert highway",
    ctaLabel: "View Sedans",
  },
  {
    id: "slide-3",
    imageUrl: "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=1920&q=80",
    alt: "Off-road vehicle in rugged terrain",
    ctaLabel: "Discover 4x4s",
  },
];

/**
 * Configuration for slider behaviour. Exposed so the future dashboard
 * can control autoplay interval, etc., without touching component logic.
 */
interface SliderConfig {
  /** Autoplay interval in milliseconds (0 = disabled) */
  autoplayInterval: number;
  /** Pause autoplay on hover/focus */
  pauseOnHover: boolean;
  /** Show navigation arrows */
  showArrows: boolean;
  /** Show dot indicators */
  showDots: boolean;
}

const DEFAULT_CONFIG: SliderConfig = {
  autoplayInterval: 3000,
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
  slides = DUMMY_SLIDES,
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
        comes from the hero and the images `object-cover` into whatever shape that
        produces.

        The consequence is that the frame's aspect ratio is now the viewport's
        rather than a designed one. That is the right trade for a full-bleed hero:
        `object-cover` crops rather than letterboxes, so there is never a black
        bar inside the image, and a portrait phone gets a portrait crop of a
        landscape photograph - which is a better result than a 16:9 box with empty
        space either side of it.
      */}
      <div className="relative h-full w-full">
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
        // The cross-fade. 500ms is slow enough to read as a dissolve rather than
        // a cut, and `ease-out-soft` decelerates into the incoming slide so it
        // arrives rather than stopping.
        "absolute inset-0 transition-opacity duration-500 ease-out-soft",
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
 * The actual `<img>` with proper sizing, loading, and error handling.
 */
function SlideImage({ src, alt }: { src: string; alt: string }) {
   
  return (
    <img
      src={src}
      alt={alt}
      // `object-cover` rather than `contain`: the frame is now the viewport's
      // shape (see the note on the slide container), so the image has to fill it
      // and crop. `contain` would letterbox a landscape photograph into a portrait
      // phone and put black bars inside the hero.
      className="h-full w-full object-cover"
      loading="eager"
      fetchPriority="high"
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 80vw"
      // A placeholder so the frame is never a white flash while the photograph
      // decodes. This is a gradient of two *surfaces*, not of two hues, so it
      // cannot shift the perceived colour of the image that replaces it - and on
      // the black canvas it is nearly black, which is what a loading hero should
      // look like rather than a grey box.
      style={{
        backgroundImage: `linear-gradient(135deg, var(--surface-sunken) 0%, var(--surface-raised) 100%)`,
      } as React.CSSProperties}
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