import { cache } from "react";

import type { Vehicle } from "@/types/vehicle";

/**
 * The inventory source.
 *
 * ---------------------------------------------------------------------------
 * The one function that will change when real data arrives
 * ---------------------------------------------------------------------------
 * `listVehicles()` is the only place in the frontend that knows where vehicles
 * come from. Today it returns an empty array. When the backend exposes a real
 * inventory endpoint it becomes a `fetch` through the existing typed client
 * (`lib/api/client.ts`), and when the database schema is agreed it can be read
 * directly - but either way this is the single function that changes, and the
 * page, the grid and the card do not.
 *
 * It is `async` even though it currently awaits nothing. That is intentional:
 * the function is the seam, and making it synchronous now would mean changing
 * its call sites, and their loading behaviour, on the day the data lands.
 *
 * ---------------------------------------------------------------------------
 * Why the empty array is a feature and not a placeholder
 * ---------------------------------------------------------------------------
 * `docs/architecture.md` is explicit - "No seed data, no fake vehicles, no fake
 * statistics." An empty list is the truthful representation of a business that
 * has confirmed its address and its trade but has not published stock to the
 * web. The page renders a real empty state from it, which is the same component
 * that will render "no results" for a filter that matched nothing later.
 *
 * A seeded list of eight cars would make this page look finished and would be
 * the single most damaging thing in the repository: every price, mileage and
 * year would be a fabrication that a customer could be shown.
 */
export async function listVehicles(): Promise<Vehicle[]> {
  return [];
}

/**
 * Looks up one vehicle by its URL slug.
 *
 * ---------------------------------------------------------------------------
 * Built on `listVehicles()`, deliberately
 * ---------------------------------------------------------------------------
 * This calls `listVehicles()` rather than reaching for a second source. That is
 * the whole point: a single-vehicle lookup that had its own data access would be a
 * second inventory architecture, and the two would be free to disagree - the grid
 * listing a car the detail page calls missing, which is the most confusing failure
 * a vehicle site can produce.
 *
 * Keeping the lookup expressed as a filter over the list also means the
 * "unknown vehicle" case needs no special handling here. With an empty inventory
 * the honest answer is `null`, the page calls `notFound()`, and that is the
 * truthful result rather than a placeholder object. When a real backend arrives
 * this becomes a keyed query and the contract at the call site does not change.
 *
 * ---------------------------------------------------------------------------
 * Slug matching is forgiving on input and strict on stored values
 * ---------------------------------------------------------------------------
 * A visitor can type anything into the address bar, and URLs get copied with
 * trailing slashes, uppercase letters or percent-encoding. The comparison
 * therefore trims and lower-cases before matching, so `/inventory/BMW-X5` and
 * `/inventory/bmw-x5` reach the same vehicle.
 *
 * It does not *alter* anything: a slug that is not in the data is still a miss.
 * The one thing deliberately not done is guessing - there is no "did you mean",
 * and no fuzzy matching that could resolve a mistyped slug to a different car. A
 * 404 that sends someone to the inventory is a better outcome than a page that
 * silently shows them the wrong vehicle.
 *
 * ---------------------------------------------------------------------------
 * `cache` is what makes this safe to call from two places
 * ---------------------------------------------------------------------------
 * The detail page calls this from both `generateMetadata` and the page body, and
 * both would otherwise run the lookup. Wrapping it in React's `cache` dedupes
 * that within a single request, so the title and the rendered vehicle are
 * guaranteed to come from the same read - and so the eventual `fetch` in here
 * happens once rather than twice.
 */
export const getVehicleBySlug = cache(
  async (slug: string): Promise<Vehicle | null> => {
    const wanted = slug.trim().toLowerCase();

    const vehicles = await listVehicles();

    return vehicles.find((vehicle) => vehicle.slug.toLowerCase() === wanted) ?? null;
  },
);

/**
 * Display label for each availability state.
 *
 * Lives here, beside the model, rather than at each call site, so a vehicle can
 * never be called "Sold" on the card and "SOLD" on a detail page. Paired with
 * the `Badge` tones documented in `components/ui/badge.tsx`.
 */
export const VEHICLE_STATUS_LABELS: Record<Vehicle["status"], string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
};
