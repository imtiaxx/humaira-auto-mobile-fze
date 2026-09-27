/**
 * Vehicle endpoint bindings.
 *
 * ---------------------------------------------------------------------------
 * The wire contract, agreed
 * ---------------------------------------------------------------------------
 * `lib/api/health.ts` exists because Step 1 built a working endpoint. This file
 * was written before the endpoint, so that the frontend's half of the contract
 * could be reviewed while it was still cheap to change. Step 10 built the
 * backend, and nothing here had to move to accommodate it: the response schema,
 * the page envelope and the two routes all match what was declared here.
 *
 * That is the outcome worth recording, because a binding written as a guess is
 * usually the thing that has to change. It did not, and that is not luck - the
 * frontend's `types/vehicle.ts` was written from the rendered requirements
 * first, and the backend was built to satisfy that rather than the reverse.
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
 * "availability". This file uses `make` and `status`, matching
 * `types/vehicle.ts`, and the backend was built to match *this* file rather than
 * the plan:
 *
 * A field that is renamed on the way through the seam is a field that can be
 * renamed *wrong*, and the only symptom is a blank specification row that nobody
 * notices. One vocabulary from the database to the DOM means the translation
 * table is empty and there is nothing to get wrong. The database columns are
 * `brand` and `availability`, and Pydantic's `serialization_alias` turns them
 * into `make` and `status` on the way out - one line, covered by the backend's
 * own tests, and invisible to every renderer.
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
 * A vehicle as the backend serialises it: snake_case, nullable-optional
 * fields explicit, and no defaulting.
 *
 * This is `GET /api/v1/vehicles/{slug}` and the `items` entries of
 * `GET /api/v1/vehicles`, as implemented in `backend/app/schemas/vehicle.py`.
 * `brand` and `availability` are database column names; the schema's
 * `serialization_alias` emits them as `make` and `status` so the vocabulary
 * matches `types/vehicle.ts`.
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
 * Available and correct, but deliberately not used by the site yet.
 * `getVehicleBySlug()` filters `listVehicles()` instead, because a detail page
 * reading a different source than the grid is how a vehicle ends up listed in
 * one place and 404ing in another.
 *
 * This is the future migration path, and the constraint on it is that both
 * callers move together - grid and detail, same read. Until that happens, the
 * unused function is the honest record of an endpoint that exists but that the
 * frontend has decided not to depend on yet.
 */
export function getVehicleBySlugRemote(
  slug: string,
): Promise<VehicleRecord> {
  return apiGet<VehicleRecord>(`/vehicles/${encodeURIComponent(slug)}`);
}
