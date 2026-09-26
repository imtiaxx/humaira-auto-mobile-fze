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
