"use client";

/**
 * The showroom section - directly beneath the hero.
 *
 * ---------------------------------------------------------------------------
 * What changed and why
 * ---------------------------------------------------------------------------
 * Four problems were reported against the previous version. Each is fixed at a
 * different level, which is the point:
 *
 * 1. *"The text looks unpolished, with highlighted or boxed text and weak
 *    hierarchy."*
 *    Fixed in two places. The heading is now its own component with a real type
 *    scale (`clamp(28px, 4.5vw, 44px)`, tight tracking) rather than inheriting
 *    whatever the section happened to have; and the mangled `subtitle` field
 *    ("hilux 0 mi 18/100 Automatic") is dropped by the mapper and rebuilt from
 *    structured fields, which is what removed the run-on text.
 *
 * 2. *"The New/Used buttons look like two unrelated buttons."*
 *    Fixed by modelling it as one control - a `tablist` in a single bordered
 *    container with a roving tabindex. See `tab-switch.tsx`.
 *
 * 3. *"Broken images show raw alt text."*
 *    Fixed in the card, and the underlying cause is data: all eight Unsplash URLs
 *    404. The card renders `alt=""` (the heading already names the car) and swaps
 *    in a designed placeholder on error, so a dead URL can never print text. The
 *    URLs themselves still need replacing - see the section comment on
 *    `showroom-cars.ts`.
 *
 * 4. *"Cards show no specs, price or call to action."*
 *    Fixed in the card. The specs line, the price and the destination hint are all
 *    present, and every one of them is optional-tolerant because the mapper
 *    guarantees a display string for all of them.
 *
 * ---------------------------------------------------------------------------
 * Data
 * ---------------------------------------------------------------------------
 * This component takes `cars` as a prop and contains no vehicle data. The mapping
 * from whatever the source is into `ShowroomCar` happens in
 * `features/home/lib/showroom-cars.ts`; the page supplies the result. That is what
 * makes swapping the placeholder array for the real `/api/v1/vehicles` a change
 * to one line in the page rather than a rewrite of this file.
 */

import { useId, useState } from "react";

import { Container } from "@/components/ui/container";
import { CarCard } from "@/features/home/components/showroom/car-card";
import {
  SectionHeader,
  ViewAllLink,
} from "@/features/home/components/showroom/section-header";
import { TabSwitch } from "@/features/home/components/showroom/tab-switch";
import {
  countByType,
  type CarType,
  type ShowroomCar,
} from "@/features/home/lib/showroom-cars";

/**
 * The inventory route.
 *
 * The brief asked for a link to `/cars`. There is no `/cars` route in this
 * application - the public inventory is `/inventory` - and pointing a section's
 * primary call to action at a 404 is exactly what this repository's
 * `navigation/config.ts` argues against at length. One constant, easy to change
 * once a `/cars` alias exists.
 */
const VIEW_ALL_HREF = "/inventory";

const EYEBROW = "Welcome to";
const TITLE = "Humera Automobile Cars";
const DESCRIPTION =
  "Explore our curated selection of new and pre-owned vehicles. Every car is inspected and ready for delivery.";

export function WelcomeSection({
  cars,
  viewAllHref = VIEW_ALL_HREF,
}: {
  cars: readonly ShowroomCar[];
  /** Overridable so the destination can change without editing this component. */
  viewAllHref?: string;
}) {
  const [active, setActive] = useState<CarType>("new");
  const counts = countByType(cars);

  // Ids owned here rather than inside `TabSwitch` because the panel the tabs
  // control is rendered by this component - the tab and the panel have to agree
  // on one id, and `useId` called twice would not.
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const panelId = `${baseId}-panel`;
  const tabIds: Record<CarType, string> = {
    new: `${baseId}-tab-new`,
    used: `${baseId}-tab-used`,
  };

  // Filtering is a client-side `filter` over the prop. No page reload, no fetch,
  // and it stays instant as the list grows because it is a single pass over an
  // array that is already in memory.
  const visible = cars.filter((car) => car.type === active);

  return (
    <section
      aria-labelledby={titleId}
      className="backdrop-cinematic relative scroll-mt-24 overflow-hidden py-16 sm:py-20 lg:py-28"
    >
      {/*
        The thin red rule that opens the section. On a monochrome page it is what
        separates this block from the hero above it - the brief asks for a strong
        visual hierarchy, and on black that hierarchy is carried by spacing and
        hairlines rather than by fills.
      */}
      <span aria-hidden="true" className="rule-accent" />

      <Container className="relative">
        <SectionHeader eyebrow={EYEBROW} title={TITLE} description={DESCRIPTION} titleId={titleId}>
          <TabSwitch
            active={active}
            onChange={setActive}
            counts={counts}
            labelledBy={titleId}
            tabIds={tabIds}
            panelId={panelId}
          />
        </SectionHeader>

        {/*
          The grid. `auto-fill` + `minmax(310px, 1fr)` gives exactly the three
          breakpoints the brief asks for without a single breakpoint class, because
          the column count falls out of the available width:
            3 columns up to 1280px (the page container's cap) - 3 x 310 + 2 x 22
              = 974px fits, 4 would need 1306px
            2 columns on tablet
            1 column on mobile
          It also degrades sanely between those points, which a fixed
          `lg:grid-cols-3` cannot.
        */}
        <div
          role="tabpanel"
          id={panelId}
          aria-labelledby={tabIds[active]}
          className="mt-12 grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-[22px]"
        >
          {visible.map((car) => (
            <CarCard key={car.id} car={car} />
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="mt-12 text-center text-body text-fg-secondary">
            {active === "new"
              ? "No new vehicles are listed right now. Our used stock is below."
              : "No used vehicles are listed right now. New arrivals are on the way."}
          </p>
        ) : null}

        <ViewAllLink href={viewAllHref} label="View all cars" />
      </Container>
    </section>
  );
}
