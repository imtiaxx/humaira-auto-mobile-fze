import { cache } from "react";

import { getVehiclePage } from "@/lib/api/vehicles";
import { toInventoryPage } from "@/features/vehicles/lib/vehicle-schema";
import type { PageParams } from "@/types/api";
import type { ApiError } from "@/lib/api/errors";
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
 *
 * ---------------------------------------------------------------------------
 * How this becomes a real inventory
 * ---------------------------------------------------------------------------
 * Everything needed for that swap is built and tested; only the call is missing,
 * because there is no endpoint to call. `docs/architecture.md` records `Vehicle`
 * as deliberately unmodelled until the business agrees the schema, and inventing
 * the call now would mean shipping a request to a route that does not exist.
 *
 * The swap is one line, when the endpoint lands:
 *
 * ```ts
 * export async function listVehicles(): Promise<Vehicle[]> {
 *   return (await listVehiclesFromSource()).vehicles;
 * }
 * ```
 *
 * `VehicleCard`, the grid, the inventory page and the detail page do not change.
 * That is the property worth having, and it is why the rest of this file is
 * shaped the way it is: the API binding lives in `lib/api/vehicles.ts`, the
 * wire-to-domain translation lives in `lib/vehicle-schema.ts`, and this file only
 * decides *whether* to read from a source. Three concerns, one seam, and the
 * page layer never learns where the data came from.
 */
export async function listVehicles(): Promise<Vehicle[]> {
  return [];
}

/** What a read from a real inventory source produced. */
export interface VehicleSourceResult {
  /** Records that passed validation. Empty when `ok` is `false`. */
  vehicles: Vehicle[];
  /** Total matching records across all pages, per the backend's envelope. */
  total: number;
  /** True when the source holds more vehicles than were returned. */
  hasNextPage: boolean;
  /** False when the source could not be read at all. */
  ok: boolean;
  /**
   * Records the source returned that could not be represented as a `Vehicle`.
   * Non-zero means the backend and this frontend disagree.
   */
  rejected: number;
  /**
   * Why the read failed, or `null` on success.
   *
   * Returned rather than swallowed, because "we have no stock" and "we could not
   * reach the inventory service" are different facts and only the business can
   * tell them apart. The customer-facing fallback below is the empty state,
   * because that is what a visitor should see during an outage; this field is
   * what an operator needs, and it is the one piece a future step has to wire to
   * whatever alerting the deployment uses.
   */
  error: ApiError | null;
}

/**
 * Reads vehicles from the real API, validated and normalised.
 *
 * ---------------------------------------------------------------------------
 * Why a failed read degrades instead of throwing
 * ---------------------------------------------------------------------------
 * `apiGet` throws on every failure: a refused connection, a timeout, a 500, a
 * body that is not JSON. Nothing catches that today because nothing calls it.
 *
 * The first time it is called, an unhandled rejection here would not degrade
 * gracefully - it would replace the inventory page with the route error boundary,
 * so a momentary backend hiccup would take a customer-facing page down and show
 * a stack-trace-flavoured apology instead of a business that still trades.
 *
 * A vehicle site that shows "no vehicles are published" during an outage is
 * wrong in a quiet, harmless way. One that shows a 500 is wrong in a way a
 * customer sees and a search engine records. So the read is treated as
 * best-effort: on failure it returns an empty result, the page renders its
 * existing professional empty state, and the reason is handed back in `error` so
 * it is not lost.
 *
 * Catching broadly rather than only `ApiError` is intentional for the same
 * reason. A bug in the normaliser is just as capable of taking the page down as
 * a bad response, and the correct customer-facing behaviour is identical.
 */
export async function listVehiclesFromSource(
  params: PageParams = {},
): Promise<VehicleSourceResult> {
  try {
    const page = toInventoryPage(await getVehiclePage(params));

    return {
      vehicles: page.vehicles,
      total: page.total,
      hasNextPage: page.hasNextPage,
      rejected: page.rejected,
      ok: true,
      error: null,
    };
  } catch (cause) {
    return {
      vehicles: [],
      total: 0,
      hasNextPage: false,
      rejected: 0,
      ok: false,
      error: cause instanceof Error ? (cause as ApiError) : null,
    };
  }
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
