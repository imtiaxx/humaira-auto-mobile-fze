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
    <Surface className="flex flex-col h-full overflow-hidden transition-shadow hover:shadow-xl">
      {/* Image carousel */}
      <div className="relative aspect-[4/3] overflow-hidden bg-sunken">
        <Image
          src={car.images[currentImageIndex]}
          alt={`${car.title} - image ${currentImageIndex + 1}`}
          fill
          className="object-cover transition-opacity duration-300"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        {car.images.length > 1 && (
          <>
            <button
              onClick={() => setCurrentImageIndex((i) => (i - 1 + car.images.length) % car.images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition-colors"
              aria-label="Previous image"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentImageIndex((i) => (i + 1) % car.images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition-colors"
              aria-label="Next image"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {car.images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    index === currentImageIndex ? "bg-white" : "bg-white/50 hover:bg-white/75"
                  }`}
                  aria-label={`View image ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
        <div className="absolute top-3 left-3">
          <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
            car.status === "new"
              ? "bg-accent-500 text-white"
              : "bg-sunken text-fg"
          }`}>
            {car.status === "new" ? "New" : "Used"}
          </span>
        </div>
        {car.badge && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-500 text-white">
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
        <div className="mt-auto flex items-center justify-between pt-4 border-t border-line">
          <span className="text-h4 text-accent-500 font-semibold">{car.price}</span>
          <Button variant="accent" size="md" className="shrink-0">
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
      className="scroll-mt-24 overflow-hidden border-t border-line bg-sunken"
    >
      <Container className="py-16 sm:py-20 lg:py-28">
        <SectionHeading
          eyebrow="Welcome to"
          title="Humera Automobile Cars"
          description="Explore our curated selection of new and pre-owned vehicles. Every car is inspected and ready for delivery."
        />

        {/* Tab navigation */}
        <div className="mt-10 flex justify-center" role="tablist" aria-label="Vehicle condition">
          <button
            role="tab"
            aria-selected={activeTab === "new"}
            aria-controls="new-cars-panel"
            id="new-cars-tab"
            onClick={() => setActiveTab("new")}
            className={`px-6 py-3 text-label font-semibold rounded-lg transition-colors ${
              activeTab === "new"
                ? "bg-accent-500 text-white"
                : "text-fg-secondary hover:text-fg hover:bg-sunken"
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
            className={`ml-3 px-6 py-3 text-label font-semibold rounded-lg transition-colors ${
              activeTab === "used"
                ? "bg-accent-500 text-white"
                : "text-fg-secondary hover:text-fg hover:bg-sunken"
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