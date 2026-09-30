/**
 * Placeholder showroom data.
 *
 * ---------------------------------------------------------------------------
 * Read this before using it
 * ---------------------------------------------------------------------------
 * These rows are scaffolding, not inventory. The names are the vehicles the
 * dealership has actually photographed, and the photographs are their own - pulled
 * from the previous website - so the page does not ship with grey placeholder
 * boxes. But the *records* are not real: the database is deliberately empty until
 * stock is entered through the staff vehicle manager, because this project
 * refuses to present a car as available when nobody has confirmed it is.
 *
 * That distinction is the whole reason this file is quarantined here rather than
 * seeded into the database. When the real vehicles are entered, this file is
 * deleted and `fromVehicles()` takes over - see `app/(marketing)/page.tsx`.
 *
 * A note on the earlier Unsplash photographs: they are gone, and they were never
 * displaying. All eight URLs returned 404, which is why the section showed raw
 * alt text on a black box. The three in `public/hero/` are real files in this
 * repository, so this failure mode cannot recur.
 */
import type { LegacyShowroomCar } from "@/features/home/lib/showroom-cars";

/**
 * The rows as the section previously held them, unchanged in shape.
 *
 * Kept in the original shape deliberately: the mapper in `showroom-cars.ts` is
 * what converts them, and leaving the awkward field names (`title`/`subtitle`,
 * `"Request Price"` in the price slot) visible here is the honest record of what
 * the data actually looked like.
 *
 * `href` is empty for every row because these rows have no slug. The card renders
 * a non-interactive card rather than an anchor to nowhere. Real vehicles from
 * `fromVehicles()` do get a real `href`.
 */
export const PLACEHOLDER_CARS: readonly LegacyShowroomCar[] = [
  {
    id: "placeholder-hilux-rocco",
    title: "Toyota Hilux Rocco 2.8",
    subtitle: "hilux 0 mi 18/100 Automatic",
    mileage: "0 mi",
    transmission: "Automatic",
    price: "Request Price",
    // The dealership's own photograph of its own Land Cruiser. Reused rather than
    // inventing a second image, and it is labelled as a Land Cruiser elsewhere on
    // the site - which is exactly the kind of mismatch that appears when placeholders
    // are used for real data. Swap for the real upload when one exists.
    images: ["/hero/hero-slide-3.jpg"],
    status: "new",
  },
  {
    id: "placeholder-hilux-revo",
    title: "Toyota Hilux Revo Rocco Grey",
    subtitle: "hilux 0 mi 18/100 Automatic",
    mileage: "0 mi",
    transmission: "Automatic",
    price: "Request Price",
    images: ["/hero/hero-slide-3.jpg"],
    status: "new",
  },
  {
    id: "placeholder-land-cruiser-prado",
    title: "Toyota Land Cruiser Prado",
    subtitle: "Land Cruiser Prado Automatic",
    mileage: "",
    transmission: "Automatic",
    price: "Request Price",
    images: ["/hero/hero-slide-3.jpg"],
    status: "new",
  },
  {
    id: "placeholder-lexus-lx600",
    title: "Lexus LX 600",
    subtitle: "LX 600 50000 mi 18/100 Manual",
    mileage: "50,000 mi",
    transmission: "Manual",
    price: "Request Price",
    images: ["/hero/hero-slide-2.jpg"],
    status: "used",
  },
  {
    id: "placeholder-amg-g63",
    title: "Mercedes AMG G63",
    subtitle: "AMG G63 20 mi Automatic",
    mileage: "20 mi",
    transmission: "Automatic",
    price: "Request Price",
    images: ["/hero/hero-slide-1.jpg"],
    status: "new",
  },
];
