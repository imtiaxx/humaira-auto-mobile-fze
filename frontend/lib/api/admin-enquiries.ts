/**
 * Staff enquiry endpoint bindings.
 *
 * ---------------------------------------------------------------------------
 * Every call here forwards the session
 * ---------------------------------------------------------------------------
 * All three routes require `CurrentStaff`. There is no anonymous variant, so
 * `session: "forward"` is not a policy decision at each call site but a property
 * of the namespace - the same arrangement `admin-vehicles.ts` uses. A binding
 * that forgot it would surface as a `401` immediately, rather than as a silent
 * authorisation gap.
 *
 * ---------------------------------------------------------------------------
 * Why the wire types are wider than `types/enquiry.ts`
 * ---------------------------------------------------------------------------
 * `status` is `string` here and a union in the domain type. `apiGet`/`apiSend`
 * document themselves as an assertion rather than a check, so claiming
 * `"pending" | "answered" | "closed"` would make TypeScript report that every
 * response conforms and the guarantee would be an illusion - the assertion is
 * erased at runtime. `features/staff/lib/enquiry-schema.ts` is where the wire is
 * narrowed to something renderable.
 */

import { apiGet, apiSend } from "@/lib/api/client";

/** An enquiry as the staff surface receives it, in wire spelling. */
export interface EnquiryRecord {
  id: string;
  vehicle_id: string;
  vehicle_slug: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  message: string;
  /** Widened to `string`. See the note at the top of this file. */
  status: string;
  created_at: string;
  updated_at: string;
}

/** A page of enquiries in wire spelling. */
export interface EnquiryPageRecord {
  items: EnquiryRecord[];
  total: number;
  page: number;
  per_page: number;
}

export interface EnquiryListQuery {
  status?: string;
  page?: number;
  perPage?: number;
}

/**
 * One page of enquiries, newest first.
 *
 * `status` is passed through unvalidated on purpose. The backend constrains it,
 * so an unknown value produces a 422 rather than a wrong list, and duplicating
 * the enum here would give the two sides a second place to drift apart.
 */
export function getEnquiryPage(
  query: EnquiryListQuery = {},
): Promise<EnquiryPageRecord> {
  return apiGet<EnquiryPageRecord>("/enquiries", {
    session: "forward",
    query: {
      status: query.status,
      page: query.page,
      per_page: query.perPage,
    },
  });
}

/** One enquiry by id. Throws an `ApiError` with status 404 when absent. */
export function getEnquiry(enquiryId: string): Promise<EnquiryRecord> {
  return apiGet<EnquiryRecord>(`/enquiries/${encodeURIComponent(enquiryId)}`, {
    session: "forward",
  });
}

/**
 * Moves an enquiry to a new status.
 *
 * Returns the updated record rather than an acknowledgement, so the caller
 * renders what the database now holds instead of what it asked for. A staff
 * member watching a badge that disagrees with the API response is worse than one
 * waiting half a second longer.
 */
export function updateEnquiryStatus(
  enquiryId: string,
  status: string,
): Promise<EnquiryRecord> {
  return apiSend<EnquiryRecord>(
    "PATCH",
    `/enquiries/${encodeURIComponent(enquiryId)}/status`,
    { json: { status }, session: "forward" },
  );
}
