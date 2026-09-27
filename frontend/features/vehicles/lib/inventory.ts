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
 * The one function that knows where vehicles come from
 * ---------------------------------------------------------------------------
 * `listVehicles()` is the only place in the frontend that knows vehicles are
 * read from the API. The page, the grid and the card never learn: they call this
 * and receive domain `Vehicle[]`, whoever produced them.
 *
 * The seam was built in Step 9 as a documented `return []`, so the day real
 * inventory existed the swap would be one line and no call site would move. That
 * day is this one. `VehicleCard`, the grid, the inventory page and the detail
 * page are all unchanged, which is the property worth having: the API binding
 * lives in `lib/api/vehicles.ts`, the wire-to-domain translation lives in
 * `lib/vehicle-schema.ts`, and this file only decides *whether* to read from a
 * source. Three concerns, one seam.
 *
 * ---------------------------------------------------------------------------
 * Why an empty list is still a real outcome
 * ---------------------------------------------------------------------------
 * `docs/architecture.md` is explicit - "No seed data, no fake vehicles, no fake
 * statistics." The dealership has not published stock, so the truthful response
 * to the list endpoint is an empty page and this site renders its real empty
 * state. That is not a fallback for missing work; it is the correct rendering of
 * what the database actually contains. A seeded list of eight cars would make
 * this page look finished and would be the single most damaging thing in the
 * repository: every price, mileage and year would be a fabrication a customer
 * could be shown.
 */

/**
 * Rows requested per page.
 *
 * Mirrors the backend's `MAX_PAGE_SIZE`. Asking for the cap rather than the
 * default 24 is deliberate: the grid renders every record it is given and has no
 * pagination control, so a larger page means fewer round trips for the same
 * result. It is a mirror, not a contract - the backend clamps whatever it is
 * sent, so raising this past 100 would simply be ignored.
 */
const PAGE_SIZE = 100;

/**
 * Hard stop on pagination, so a miscounting backend cannot spin this forever.
 *
 * 500 pages of 100 is 50,000 vehicles, two orders of magnitude past a
 * single-branch dealership. The loop below already terminates on `hasNextPage`;
 * this bounds the damage if that flag is ever wrong, which is a real risk when
 * the flag is derived from a count on another machine.
 */
const MAX_PAGES = 500;

/**
 * Reads the whole inventory, in domain form, from the real API.
 *
 * ---------------------------------------------------------------------------
 * Why this walks every page instead of asking for one
 * ---------------------------------------------------------------------------
 * The obvious implementation is a single call returning the first page, and it
 * is wrong here for a specific reason: `getVehicleBySlug()` below looks a
 * vehicle up by filtering this list. If the dealer has more stock than fits in
 * one page, that lookup would 404 for every vehicle past the boundary - the grid
 * would list a car and its own detail page would call it missing. The two would
 * disagree, which is the single most confusing failure a vehicle site can
 * produce, and it would only appear once the business was busy enough to cause
 * it.
 *
 * So this walks pages until the backend says there are no more. The alternative
 * - switching the detail page to the single-vehicle endpoint - is a deliberate
 * non-choice for now: two sources for one fact is the problem being avoided
 * here, and a slowness problem is a better one to have than a correctness one.
 * If inventory ever grows large enough for this walk to matter, both callers
 * move to the remote lookup together, as the notes in
 * `lib/api/vehicles.ts` require.
 *
 * ---------------------------------------------------------------------------
 * Why a failed page returns nothing rather than what arrived
 * ---------------------------------------------------------------------------
 * A partial list is the more dangerous of the two failure outputs. Returning the
 * first 100 of 150 vehicles renders a grid that looks complete and is not, and
 * for a dealer "that is all we have" is a materially different statement from
 * "we could not reach the inventory service". One is silently wrong; the other
 * shows the existing empty state, which is visibly a state rather than a
 * catalogue, and is the same component used for a filter that matched nothing.
 *
 * So any page failing discards the whole read and returns `[]`. The reason is
 * not lost - `listVehiclesFromSource()` hands it back in `error` for operators;
 * this function has no error channel because its callers cannot act on one.
 */
export async function listVehicles(): Promise<Vehicle[]> {
  const collected: Vehicle[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await listVehiclesFromSource({
      page,
      page_size: PAGE_SIZE,
    });

    if (!result.ok) {
      return [];
    }

    collected.push(...result.vehicles);

    if (!result.hasNextPage) {
      return collected;
    }
  }

  return collected;
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
 * Reads one page of vehicles from the real API, validated and normalised.
 *
 * ---------------------------------------------------------------------------
 * Why a failed read degrades instead of throwing
 * ---------------------------------------------------------------------------
 * `apiGet` throws on every failure: a refused connection, a timeout, a 500, a
 * body that is not JSON. `listVehicles()` calls this, and the inventory page
 * renders during a server component render where nothing above it would catch.
 *
 * Unhandled, that rejection would replace the inventory page with the route
 * error boundary, so a momentary backend hiccup would take a customer-facing
 * page down and show a stack-trace-flavoured apology instead of a business that
 * still trades.
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
 * This calls `listVehicles()` rather than reaching for a second source, even
 * though `GET /vehicles/{slug}` now exists and would answer this more directly.
 * That is the whole point: a single-vehicle lookup that had its own data access
 * would be a second inventory architecture, and the two would be free to
 * disagree - the grid listing a car the detail page calls missing, which is the
 * most confusing failure a vehicle site can produce.
 *
 * It costs something, and the cost is accepted knowingly: this is a linear scan
 * of the inventory rather than an indexed lookup. That is why `listVehicles()`
 * walks every page rather than fetching the first - otherwise this filter would
 * silently stop finding vehicles once the dealer passed 100 stock, and the
 * failure would only show up when the business got busier. The trade is
 * correctness now over efficiency, and it holds until inventory is large enough
 * that the scan is genuinely slow, at which point both this and the grid move
 * to the remote endpoint together.
 *
 * Keeping the lookup expressed as a filter over the list also means the
 * "unknown vehicle" case needs no special handling here. A slug that is not in
 * the data is a miss, the page calls `notFound()`, and that is the truthful
 * result rather than a placeholder object.
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
