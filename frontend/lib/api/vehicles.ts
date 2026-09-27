/**
 * Vehicle endpoint bindings.
 *
 * ---------------------------------------------------------------------------
 * Declared now, called later
 * ---------------------------------------------------------------------------
 * `lib/api/health.ts` exists because Step 1 built a working endpoint. This file
 * exists for the opposite reason: the backend has no vehicle endpoint yet, and
 * `docs/architecture.md` records `Vehicle` as *deliberately* unmodelled until
 * the business agrees the schema. Writing the binding now, before the endpoint,
 * is what makes the frontend's half of that agreement reviewable while it is
 * still cheap to change - and it means the day the endpoint lands, the
 * integration is "uncomment the call", not "discover what the frontend assumed".
 *
 * Nothing here imports the vehicle domain type, and nothing here validates. A
 * binding declares the *wire* contract; `features/vehicles/lib/vehicle-schema.ts`
 * turns that wire data into the domain `Vehicle`. Keeping the two apart is what
 * lets the backend rename a column without a renderer ever learning the new name.
 *
 * ---------------------------------------------------------------------------
 * Why these fields are wider than the domain type
 * ---------------------------------------------------------------------------
 * `currency` and `status` are typed `string` here, not `"USD"` and
 * `VehicleStatus`. That is deliberate and it is the whole point of this file.
 *
 * `apiGet<T>` documents itself as "an assertion, not a check; validate
 * untrusted payloads at the boundary when endpoints accept input". If this file
 * claimed `currency: "USD"`, TypeScript would report that every response
 * conformed - and the guarantee would be an illusion, because a type assertion
 * is erased at runtime and a real response can absolutely contain `"AED"`.
 *
 * So the wire types describe what the backend *may* send, the domain type
 * describes what this site is *allowed to render*, and the normaliser is the
 * single place where the difference is enforced. Widening here is what gives
 * that check something to do.
 *
 * ---------------------------------------------------------------------------
 * Naming: the wire matches the domain, not the plan
 * ---------------------------------------------------------------------------
 * `docs/architecture.md` describes the planned entity's columns as "brand" and
 * "availability". This file uses `make` and `status` instead, matching
 * `types/vehicle.ts`, and the two are kept identical deliberately:
 *
 * A field that is renamed on the way through the seam is a field that can be
 * renamed *wrong*, and the only symptom is a blank specification row that nobody
 * notices. One vocabulary from the database to the DOM means the translation
 * table is empty and there is nothing to get wrong. If the database is later
 * built with `brand` and `availability` column names, the fix belongs in the
 * Pydantic schema's `alias`, which is one line and covered by the backend's own
 * tests - not spread across a frontend mapper.
 *
 * `mileage_km` is the one place a suffix is added, and it earns it: an
 * unqualified `mileage` number is a unit bug waiting to happen, and the domain
 * formatter appends " km" on the way out. Carrying the unit in the name means
 * the value cannot be silently interpreted as miles.
 */

import { apiGet } from "@/lib/api/client";
import type { Page, PageParams } from "@/types/api";

/** One photograph, as the backend would serialise it. */
export interface VehicleImageRecord {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/**
 * A vehicle as the backend would serialise it: snake_case, nullable-optional
 * fields explicit, and no defaulting.
 *
 * Mirrors the planned `VehicleResponse` schema, which does not exist yet. When
 * it does, this interface is the place any disagreement surfaces - in review,
 * rather than as a blank row in production.
 */
export interface VehicleRecord {
  id: string;
  slug: string;
  make: string;
  model: string;
  variant: string | null;
  year: number;
  body_type: string | null;
  transmission: string | null;
  fuel: string | null;
  colour: string | null;
  /** Odometer reading in kilometres. `null` when not recorded. */
  mileage_km: number | null;
  vin: string | null;
  price: number | null;
  currency: string;
  status: string;
  location: string | null;
  images: VehicleImageRecord[] | null;
  features: Record<string, string> | null;
}

/**
 * One page of vehicles.
 *
 * Returns the whole `Page<T>` envelope rather than a bare array, because the
 * envelope carries `total` and `total_pages` and throwing them away here would
 * mean the grid could never know whether it is showing everything. The backend
 * caps a page at 100 rows (`MAX_PAGE_SIZE`), so a real inventory *will*
 * eventually exceed one page, and the seam is the only place that can carry
 * that fact forward without a rewrite.
 */
export function getVehiclePage(
  params: PageParams = {},
): Promise<Page<VehicleRecord>> {
  // Spread rather than passed directly: `PageParams` is a plain interface with no
  // index signature, so it is not assignable to the client's `Record<string, ...>`
  // query type. The spread produces a fresh object literal, which is - and it
  // keeps `PageParams` free of an index signature it does not need.
  return apiGet<Page<VehicleRecord>>("/vehicles", { query: { ...params } });
}

/**
 * One vehicle by slug.
 *
 * Present for completeness so the future integration has an obvious choice to
 * make. The current site deliberately does **not** use it: `getVehicleBySlug()`
 * filters `listVehicles()`, because a detail page reading a different source
 * than the grid is how a vehicle ends up listed in one place and 404ing in
 * another. If this endpoint is ever adopted, both callers must move together.
 */
export function getVehicleBySlugRemote(
  slug: string,
): Promise<VehicleRecord> {
  return apiGet<VehicleRecord>(`/vehicles/${encodeURIComponent(slug)}`);
}
