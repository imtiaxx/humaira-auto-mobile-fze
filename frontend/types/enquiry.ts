/**
 * Enquiry domain types.
 *
 * Split from the wire records in `lib/api/admin-enquiries.ts` for the same reason
 * `types/staff.ts` is split from `lib/api/admin-vehicles.ts`: the wire types
 * describe what the backend *may* send, these describe what this application is
 * allowed to render, and `features/staff/lib/enquiry-schema.ts` is the one place
 * that difference is enforced.
 *
 * The practical difference is `status`. It arrives as a `string`, because
 * `apiGet`/`apiSend` return a type assertion rather than a runtime check, and
 * asserting a narrow union here would make TypeScript vouch for a guarantee
 * nothing enforces. `EnquiryStatus` is a union; the parser narrows to it.
 */

/**
 * Where an enquiry is in its lifecycle.
 *
 * Mirrors the `ck_enquiries_status` CHECK constraint in the database. A fourth
 * value would need a migration, not a frontend edit, which is the correct order
 * of operations for a value the whole stack agrees on.
 */
export type EnquiryStatus = "pending" | "answered" | "closed";

/** Every status, in the order a staff member works through a backlog. */
export const ENQUIRY_STATUSES: readonly EnquiryStatus[] = [
  "pending",
  "answered",
  "closed",
] as const;

/** An enquiry, as the staff surface renders it. */
export interface Enquiry {
  id: string;
  vehicleId: string;
  vehicleSlug: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  message: string;
  status: EnquiryStatus;
  /** ISO 8601, always present: the column is `NOT NULL` with a server default. */
  createdAt: string;
  updatedAt: string;
}

/** One page of enquiries. `total` counts every match, not the page. */
export interface EnquiryPage {
  items: Enquiry[];
  total: number;
  page: number;
  perPage: number;
}
