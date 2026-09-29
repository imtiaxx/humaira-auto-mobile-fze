"use client";

import { useState } from "react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Car } from "@/components/icons";

type CarStatus = "new" | "used";

interface CarData {
  id: string;
  title: string;
  subtitle: string;
  mileage: string;
  transmission: string;
  price: string;
  images: string[];
  status: CarStatus;
  badge?: string;
}

const CARS: CarData[] = [
  {
    id: "1",
    title: "Toyota Hilux Rocco 2.8",
    subtitle: "hilux 0 mi 18/100 Automatic",
    mileage: "0 mi",
    transmission: "Automatic",
    price: "Request Price",
    images: [
      "https://images.unsplash.com/photo-1544829099-b9a0c5303bea?w=800&q=80",
      "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80",
      "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=800&q=80",
      "https://images.unsplash.com/photo-1522771870578-6b5f7a4e94e3?w=800&q=80",
      "https://images.unsplash.com/photo-1541899481282-d53bfe3cdd6e?w=800&q=80",
      "https://images.unsplash.com/photo-1519643381401-22c77e60520e?w=800&q=80",
      "https://images.unsplash.com/photo-1549317661-bb32315b2466?w=800&q=80",
      "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80",
    ],
    status: "new",
  },
  {
    id: "2",
    title: "Toyota Hilux Revo Rocco Grey",
    subtitle: "hilux 0 mi 18/100 Automatic",
    mileage: "0 mi",
    transmission: "Automatic",
    price: "Request Price",
    images: [
      "https://images.unsplash.com/photo-1544829099-b9a0c5303bea?w=800&q=80",
      "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80",
      "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=800&q=80",
      "https://images.unsplash.com/photo-1522771870578-6b5f7a4e94e3?w=800&q=80",
      "https://images.unsplash.com/photo-1541899481282-d53bfe3cdd6e?w=800&q=80",
      "https://images.unsplash.com/photo-1519643381401-22c77e60520e?w=800&q=80",
      "https://images.unsplash.com/photo-1549317661-bb32315b2466?w=800&q=80",
      "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80",
    ],
    status: "new",
  },
  {
    id: "3",
    title: "Toyota Land Cruiser Prado",
    subtitle: "Land Cruiser Prado Automatic",
    mileage: "0 mi",
    transmission: "Automatic",
    price: "Request Price",
    images: [
      "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80",
      "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=800&q=80",
      "https://images.unsplash.com/photo-1544829099-b9a0c5303bea?w=800&q=80",
      "https://images.unsplash.com/photo-1522771870578-6b5f7a4e94e3?w=800&q=80",
      "https://images.unsplash.com/photo-1541899481282-d53bfe3cdd6e?w=800&q=80",
      "https://images.unsplash.com/photo-1519643381401-22c77e60520e?w=800&q=80",
    ],
    status: "new",
  },
  {
    id: "4",
    title: "Lexus LX 600",
    subtitle: "LX 600 50000 mi 18/100 Manual",
    mileage: "50000 mi",
    transmission: "Manual",
    price: "Request Price",
    images: [
      "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=800&q=80",
      "https://images.unsplash.com/photo-1544829099-b9a0c5303bea?w=800&q=80",
      "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80",
      "https://images.unsplash.com/photo-1522771870578-6b5f7a4e94e3?w=800&q=80",
      "https://images.unsplash.com/photo-1541899481282-d53bfe3cdd6e?w=800&q=80",
    ],
    status: "used",
  },
  {
    id: "5",
    title: "Mercedes AMG G63",
    subtitle: "AMG G63 20 mi Automatic",
    mileage: "20 mi",
    transmission: "Automatic",
    price: "Request Price",
    images: [
      "https://images.unsplash.com/photo-1522771870578-6b5f7a4e94e3?w=800&q=80",
      "https://images.unsplash.com/photo-1541899481282-d53bfe3cdd6e?w=800&q=80",
      "https://images.unsplash.com/photo-1519643381401-22c77e60520e?w=800&q=80",
      "https://images.unsplash.com/photo-1549317661-bb32315b2466?w=800&q=80",
      "https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=800&q=80",
      "https://images.unsplash.com/photo-1503736334956-4c8f8e92946d?w=800&q=80",
      "https://images.unsplash.com/photo-1544829099-b9a0c5303bea?w=800&q=80",
    ],
    status: "new",
  },
];

function CarCard({ car }: { car: CarData }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  return (
    <Surface
      interactive
      className="group/card flex h-full flex-col overflow-hidden"
    >
      {/* Image carousel */}
      <div className="relative aspect-[4/3] overflow-hidden bg-sunken">
        {/*
          A slow settle on hover, matching the reveal on the hero. The card's
          border and glow are handled by `Surface interactive`; this is the
          photograph responding separately, which is what makes the card feel
          like an object rather than a rectangle.
        */}
        <Image
          src={car.images[currentImageIndex]}
          alt={`${car.title} - image ${currentImageIndex + 1}`}
          fill
          className="object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-standard)] group-hover/card:scale-[1.05]"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {/*
          A scrim top and bottom. The image is arbitrary photography, so the
          status badge and the dots both need a guaranteed contrast floor
          regardless of whether the frame is a pale sky or a black studio.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.55),transparent)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(to_top,rgb(0_0_0/0.6),transparent)]"
        />
        {car.images.length > 1 && (
          <>
            {/*
              The arrows only appear on hover. On a touch device there is no
              hover, so they stay hidden and the dots below are the only
              navigation - which is why the dots are a real target and not
              decorative.
            */}
            <button
              onClick={() => setCurrentImageIndex((i) => (i - 1 + car.images.length) % car.images.length)}
              className="absolute left-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-fg-inverse/20 bg-black/50 text-fg-inverse opacity-0 backdrop-blur-md transition-[opacity,background-color,border-color] duration-[var(--duration-base)] group-hover/card:opacity-100 focus-visible:opacity-100 hover:border-accent-500 hover:bg-black/70"
              aria-label={`Previous image of ${car.title}`}
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentImageIndex((i) => (i + 1) % car.images.length)}
              className="absolute right-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-fg-inverse/20 bg-black/50 text-fg-inverse opacity-0 backdrop-blur-md transition-[opacity,background-color,border-color] duration-[var(--duration-base)] group-hover/card:opacity-100 focus-visible:opacity-100 hover:border-accent-500 hover:bg-black/70"
              aria-label={`Next image of ${car.title}`}
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1">
              {car.images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  // 24px hit area around a 6px dot. A 6px target is below every
                  // minimum in WCAG 2.5.8 and is genuinely hard to hit on a phone.
                  className="flex size-6 items-center justify-center"
                  aria-label={`View image ${index + 1} of ${car.title}`}
                  aria-current={index === currentImageIndex}
                >
                  <span
                    aria-hidden="true"
                    className={`block size-1.5 rounded-full transition-colors ${
                      index === currentImageIndex ? "bg-accent-500" : "bg-fg-inverse/50"
                    }`}
                  />
                </button>
              ))}
            </div>
          </>
        )}
        <div className="absolute top-3 left-3">
          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
            car.status === "new"
              ? "bg-action-accent text-action-accent-content"
              : "border border-line-control bg-black/60 text-fg-inverse backdrop-blur-sm"
          }`}>
            {car.status === "new" ? "New" : "Used"}
          </span>
        </div>
        {car.badge && (
          <div className="absolute top-3 right-3">
            {/*
              `--action-danger` rather than a literal `bg-red-500`.

              The hardcoded red was a Tailwind default, not a design token, so it
              did not participate in the palette and would not have moved with the
              theme. It is also a second red on the same card as the brand red
              above, which is the two-red problem the token layer exists to
              prevent - so this uses the deep maroon reserved for urgency and keeps
              the brand red unique on the tile.
            */}
            <span className="inline-flex rounded-full bg-action-danger px-2 py-1 text-xs font-semibold text-action-danger-content">
              {car.badge}
            </span>
          </div>
        )}
      </div>

      {/* Car details */}
      <div className="flex flex-1 flex-col p-5 gap-2">
        <h3 className="text-h4 text-fg">{car.title}</h3>
        <p className="text-body-sm text-fg-secondary">{car.subtitle}</p>
        <div className="flex items-center gap-4 pt-2 border-t border-line">
          <span className="flex items-center gap-1 text-body-sm text-fg-secondary">
            <Car className="h-4 w-4" aria-hidden="true" />
            {car.mileage}
          </span>
          <span className="flex items-center gap-1 text-body-sm text-fg-secondary">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
            {car.transmission}
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
          {/*
            `text-fg-accent`, not `text-accent-500`.

            This was a real accessibility defect, not a styling preference: the
            vivid brand red measures 3.9:1 as body text on the near-black page,
            under the 4.5:1 that WCAG 1.4.3 requires, and none of the tooling
            caught it because `text-accent-500` is a raw ramp step rather than one
            of the semantic pairs the contrast script audits. `text-fg-accent`
            resolves to `accent-300`, which is 8.7:1.

            The price also gets the red glow on the card's hover, so the number
            is the thing that lights up rather than the whole tile.
          */}
          <span className="tnum text-h4 font-semibold text-fg-accent transition-shadow duration-[var(--duration-base)] group-hover/card:text-shadow-[0_0_18px_rgb(224_16_35/0.55)]">
            {car.price}
          </span>
          <Button variant="outline" size="md" className="shrink-0">
            Request Price
          </Button>
        </div>
      </div>
    </Surface>
  );
}

export function WelcomeSection() {
  const [activeTab, setActiveTab] = useState<CarStatus>("new");

  const filteredCars = CARS.filter((car) => car.status === activeTab);

  return (
    <section
      id="welcome-inventory"
      aria-label="Welcome to Humera Automobile Cars"
      className="backdrop-cinematic relative scroll-mt-24 overflow-hidden"
    >
      {/*
        The thin red rule that opens the section. It is what stops the hero and
        this block reading as one undifferentiated black field - the two are
        separated by a hairline and a change of content, which on a monochrome
        page needs a little help.
      */}
      <span aria-hidden="true" className="rule-accent" />

      <Container className="relative py-16 sm:py-20 lg:py-28">
        <SectionHeading
          eyebrow="Welcome to"
          title="Humera Automobile Cars"
          description="Explore our curated selection of new and pre-owned vehicles. Every car is inspected and ready for delivery."
        />

        {/*
          Tab navigation.

          The active tab is a filled red plate; the inactive one is a bordered
          outline. Two filled red tabs side by side would also make the tabs
          compete with the "Request Price" buttons below them, and the brief asks
          for a maximum of one strong red element per view.

          `aria-selected` plus the `tabpanel`/`aria-controls` pairing below is the
          real state - the colour is decoration on top of it, so the tabs still
          work if the styling fails to load.
        */}
        <div className="mt-12 flex justify-center" role="tablist" aria-label="Vehicle condition">
          <button
            role="tab"
            aria-selected={activeTab === "new"}
            aria-controls="new-cars-panel"
            id="new-cars-tab"
            onClick={() => setActiveTab("new")}
            className={`rounded-sm px-7 py-3 text-label font-semibold transition-[background-color,color,border-color,box-shadow] duration-[var(--duration-base)] ${
              activeTab === "new"
                ? "bg-action-accent text-action-accent-content shadow-[0_8px_24px_-10px_rgb(224_16_35/0.6)]"
                : "border border-line-control bg-transparent text-fg-secondary hover:border-accent-500 hover:text-fg-accent"
            }`}
          >
            New cars
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "used"}
            aria-controls="used-cars-panel"
            id="used-cars-tab"
            onClick={() => setActiveTab("used")}
            className={`ml-3 rounded-sm px-7 py-3 text-label font-semibold transition-[background-color,color,border-color,box-shadow] duration-[var(--duration-base)] ${
              activeTab === "used"
                ? "bg-action-accent text-action-accent-content shadow-[0_8px_24px_-10px_rgb(224_16_35/0.6)]"
                : "border border-line-control bg-transparent text-fg-secondary hover:border-accent-500 hover:text-fg-accent"
            }`}
          >
            Used cars
          </button>
        </div>

        {/* Car grid */}
        <div
          role="tabpanel"
          id={activeTab === "new" ? "new-cars-panel" : "used-cars-panel"}
          aria-labelledby={activeTab === "new" ? "new-cars-tab" : "used-cars-tab"}
          className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filteredCars.map((car) => (
            <CarCard key={car.id} car={car} />
          ))}
        </div>

        {filteredCars.length === 0 && (
          <div className="mt-10 text-center py-12">
            <p className="text-body text-fg-secondary">
              No {activeTab} cars available at the moment.
            </p>
          </div>
        )}

        {/* View all button */}
        <div className="mt-10 text-center">
          <Button variant="outline" size="lg">
            Search Inventory
          </Button>
        </div>
      </Container>
    </section>
  );
}