/**
 * Staff-facing domain types.
 *
 * ---------------------------------------------------------------------------
 * Why these are separate from the wire records
 * ---------------------------------------------------------------------------
 * `lib/api/staff-auth.ts` declares what the backend *may* send. These declare
 * what this application is *allowed to render*, and the normaliser in
 * `features/staff/lib/staff-schema.ts` is the single place the difference is
 * enforced. That split is the same one `types/vehicle.ts` and
 * `features/vehicles/lib/vehicle-schema.ts` already use for the public site, and
 * it is what lets the backend rename a column without a component learning the
 * new name.
 *
 * The practical effect: `email` and `full_name` arrive as `string | null` on the
 * wire and are required non-null here, so a staff header can render
 * `staff.full_name` without a fallback, and the fallback cannot be forgotten.
 */

/**
 * A staff account, as the admin surface uses it.
 *
 * `is_staff` is carried through rather than assumed. The backend already refuses
 * a non-staff account at `/auth/me` with `403`, so by the time one of these
 * exists it is always `true` - but rendering the name of an account whose staff
 * flag was cleared, on the strength of a check that happened somewhere else, is
 * the kind of assumption that breaks silently when a second caller is added.
 */
export interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  isStaff: boolean;
}

/** An admin vehicle, as the staff surface uses it. */
export interface StaffVehicle {
  id: string;
  slug: string;
  make: string;
  model: string;
  variant: string | null;
  year: number;
  bodyType: string | null;
  transmission: string | null;
  fuel: string | null;
  colour: string | null;
  /** Odometer reading in kilometres. `null` when not recorded. */
  mileageKm: number | null;
  vin: string | null;
  /** Asking price in USD. `null` means "price on request". */
  price: number | null;
  currency: "USD";
  status: VehicleAvailability;
  location: string | null;
  /** ISO timestamp, or `null` while the vehicle is published. */
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  images: StaffVehicleImage[];
  features: Array<{ name: string; value: string }>;
}

/**
 * The three availability states the backend defines.
 *
 * `VEHICLE_AVAILABILITY_VALUES` on the Python side, written out here because a
 * literal union is what makes `<Select>` options and a `<Badge>` tone checkable
 * at compile time. A wider `string` would let a fourth state through and render
 * as an unstyled badge, which is the failure this union exists to prevent.
 */
export type VehicleAvailability = "available" | "reserved" | "sold";

/** A photograph with the identifiers and ordering the staff surface needs. */
export interface StaffVehicleImage {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  /** Display order. `0` is the primary photograph. */
  position: number;
}

/** Real counts for the staff dashboard. Every one is a `COUNT`, never derived. */
export interface InventorySummary {
  totalPublished: number;
  archived: number;
  byAvailability: Record<string, number>;
  imageCount: number;
}
