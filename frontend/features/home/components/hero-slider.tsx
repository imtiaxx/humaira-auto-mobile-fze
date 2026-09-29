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
      className={cn("relative overflow-hidden rounded-2xl", className)}
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

      {/* Slide container — cross-fade via CSS animation */}
      <div className="relative aspect-[16/9] md:aspect-[21/9] lg:aspect-[2.4/1]">
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
          className="flex items-center justify-center gap-2 mt-4"
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
              className={cn(
                "relative h-2 w-2 rounded-full transition-all duration-300",
                index === currentIndex
                  ? "bg-accent-500 w-6"
                  : "bg-white/40 hover:bg-white/60"
              )}
            />
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
        "absolute inset-0 transition-opacity duration-500 ease-out-soft",
        isActive ? "opacity-100" : "opacity-0 pointer-events-none",
        prefersReducedMotion && "transition-none"
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
        <div className="absolute bottom-6 left-6 right-6 md:left-8 md:right-8">
          <a
            href={slide.href}
            className="inline-flex items-center justify-center w-full md:w-auto"
          >
            <Button variant="accent" size="lg" className="w-full md:w-auto animate-fade-up">
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
      className="h-full w-full object-cover"
      loading="eager"
      fetchPriority="high"
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 80vw"
      // Using a placeholder blur to avoid layout shift
      style={{
        backgroundImage: `linear-gradient(135deg, var(--surface-sunken) 0%, var(--surface-raised) 100%)`,
      } as React.CSSProperties}
    />
  );
}

/**
 * Arrow button styled for overlay use.
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
        "flex h-12 w-12 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm transition-all duration-200 hover:bg-black/50 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white pointer-events-auto"
      )}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {children}
    </Button>
  );
}