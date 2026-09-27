/**
 * Admin vehicle endpoint bindings.
 *
 * ---------------------------------------------------------------------------
 * Every call here forwards the session
 * ---------------------------------------------------------------------------
 * All of these routes are under `/admin`, and every one of them requires
 * `CurrentStaff`. There is no anonymous variant, so `session: "forward"` is not a
 * policy decision at each call site but a property of the namespace - which is
 * exactly the value of the split the backend made when it kept privileged
 * writes off the public resource. A binding that forgot it would surface as a
 * `401`, immediately, rather than as a silent authorisation gap.
 *
 * ---------------------------------------------------------------------------
 * Why the wire types are wider than `types/staff.ts`
 * ---------------------------------------------------------------------------
 * `currency` and `status` are `string` here, not `"USD"` and `VehicleAvailability`.
 * `apiSend`/`apiGet` document themselves as an assertion rather than a check, so
 * claiming `"USD"` would have TypeScript report that every response conforms and
 * the guarantee would be an illusion - a type assertion is erased at runtime, and
 * a real row can contain `"AED"` until a constraint is added. The wire describes
 * what the backend may send, the domain type describes what may be rendered, and
 * `features/staff/lib/staff-schema.ts` is where the difference is enforced.
 *
 * This is the same reasoning as `lib/api/vehicles.ts`, and the same two
 * functions should be read together: one file for the public read path, one for
 * the staff write path, neither importing the other's domain type.
 */

import { apiGet, apiSend } from "@/lib/api/client";
import type { Page, PageParams } from "@/types/api";

/** A photograph as the staff surface receives it, with id and ordering. */
export interface StaffVehicleImageRecord {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  position: number;
}

/** A vehicle as the staff surface receives it. */
export interface StaffVehicleRecord {
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
  mileage_km: number | null;
  vin: string | null;
  price: number | null;
  currency: string;
  status: string;
  location: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  images: StaffVehicleImageRecord[];
  features: Record<string, string> | null;
}

/** Acknowledgement of an archive or restore. */
export interface VehicleArchiveRecord {
  id: string;
  slug: string;
  /** ISO timestamp, or `null` after a restore. */
  archived_at: string | null;
  status: string;
}

/** Real counts for the staff dashboard. */
export interface InventorySummaryRecord {
  total_published: number;
  archived: number;
  by_availability: Record<string, number>;
  image_count: number;
}

/**
 * The body accepted by both create and update.
 *
 * Mirrors `backend/app/schemas/vehicle_write.py::VehicleWriteBase` field for
 * field, including the rules that shape the values rather than the types:
 *
 * - Optional text is sent as `null`, never `""`. The backend collapses blank
 *   strings to `null` anyway, and sending `null` means what it means.
 * - `price` is `null` for "price on request" and a positive number otherwise.
 *   The backend rejects `0`; there is no free car, and a `0` that meant "unset"
 *   would have been a second spelling of `null`.
 * - `currency` is sent as a constant. The backend accepts the field and refuses
 *   every value except `USD`, precisely so that posting `"AED"` fails loudly
 *   instead of being silently stored as USD.
 * - There is no `archived_at`. Archiving has its own endpoints, and the backend
 *   sets `extra="forbid"` so a form cannot post this field even by accident.
 */
export interface VehicleWriteBody {
  slug: string;
  make: string;
  model: string;
  variant: string | null;
  year: number;
  body_type: string | null;
  transmission: string | null;
  fuel: string | null;
  colour: string | null;
  mileage_km: number | null;
  vin: string | null;
  price: number | null;
  currency: string;
  status: string;
  location: string | null;
  features: Record<string, string> | null;
}

/**
 * One page of vehicles, **including archived**.
 *
 * The admin list differs from the public one in exactly this way, and it is the
 * difference that makes the page useful: the most common reason a staff member
 * opens a vehicle is to restore it, or to fix whatever made it unsellable.
 */
export function getStaffVehiclePage(
  params: PageParams = {},
): Promise<Page<StaffVehicleRecord>> {
  return apiGet<Page<StaffVehicleRecord>>("/admin/vehicles", {
    query: { ...params },
    session: "forward",
  });
}

/** Counts for the dashboard. */
export function getInventorySummary(): Promise<InventorySummaryRecord> {
  // `/-/summary` is declared before `/{vehicle_id}` in the backend so FastAPI
  // cannot match this literal segment as a UUID. The `-` is a further guarantee:
  // no UUID begins with a hyphen, so the two can never collide.
  return apiGet<InventorySummaryRecord>("/admin/vehicles/-/summary", {
    session: "forward",
  });
}

/** One vehicle, archived or not. */
export function getStaffVehicle(vehicleId: string): Promise<StaffVehicleRecord> {
  return apiGet<StaffVehicleRecord>(`/admin/vehicles/${encodeURIComponent(vehicleId)}`, {
    session: "forward",
  });
}

/**
 * Creates one vehicle.
 *
 * `409` when the slug or VIN is already in use. That is worth distinguishing
 * from a `422` in the form: a duplicate slug is a conflict with an existing
 * record rather than a bad value, and telling a staff member to "choose a
 * different VIN" is more use than "invalid input".
 */
export function createVehicle(body: VehicleWriteBody): Promise<StaffVehicleRecord> {
  return apiSend<StaffVehicleRecord>("POST", "/admin/vehicles", {
    json: body,
    session: "forward",
  });
}

/**
 * Replaces a vehicle's editable fields.
 *
 * The body is the complete record, not a patch of changes, and the backend
 * requires every field for the same reason. An edit form always submits
 * everything it has; a partial contract would only invite a caller to believe it
 * can change one field and silently blank the rest.
 */
export function updateVehicle(
  vehicleId: string,
  body: VehicleWriteBody,
): Promise<StaffVehicleRecord> {
  return apiSend<StaffVehicleRecord>(
    "PATCH",
    `/admin/vehicles/${encodeURIComponent(vehicleId)}`,
    { json: body, session: "forward" },
  );
}

/**
 * Withdraws a vehicle from public sale.
 *
 * There is no `DELETE` counterpart anywhere in this file, and that absence is
 * the design rather than an omission: a `DELETE` that silently archives lies in
 * the HTTP contract, and a `DELETE` that really deletes is a decision that
 * belongs behind its own confirmation.
 */
export function archiveVehicle(vehicleId: string): Promise<VehicleArchiveRecord> {
  return apiSend<VehicleArchiveRecord>(
    "POST",
    `/admin/vehicles/${encodeURIComponent(vehicleId)}/archive`,
    { session: "forward" },
  );
}

/** Returns an archived vehicle to public sale. */
export function restoreVehicle(vehicleId: string): Promise<VehicleArchiveRecord> {
  return apiSend<VehicleArchiveRecord>(
    "POST",
    `/admin/vehicles/${encodeURIComponent(vehicleId)}/restore`,
    { session: "forward" },
  );
}
