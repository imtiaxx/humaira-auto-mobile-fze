/**
 * The public enquiry endpoint binding.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists on its own
 * ---------------------------------------------------------------------------
 * The staff half of enquiries lives in `admin-enquiries.ts`. They are separate
 * because their session policies are opposites, and keeping them apart makes the
 * difference visible at every call site instead of a decision each binding has
 * to remember:
 *
 * - here, no session, ever. A cookie cannot change what is stored - the
 *   backend's `EnquiryWrite` forbids extra fields - but forwarding one to an
 *   endpoint that has no use for it would hand a credential to a public route.
 * - there, `session: "forward"` on every call, because every staff route
 *   requires `CurrentStaff`.
 *
 * ---------------------------------------------------------------------------
 * Why the form does not call `fetch` from the browser
 * ---------------------------------------------------------------------------
 * `lib/api/client.ts` is deliberately server-only. A browser-side POST would
 * need CORS for a write, would put the API origin in client JavaScript, and would
 * make the form's outcome depend on the visitor's browser reaching a second
 * origin. The public form submits through a Server Action instead, so this call
 * is made by the Next server: one same-origin request, no credential, no
 * preflight.
 */

import { apiSend } from "@/lib/api/client";

/** What the public form collects. There are deliberately no vehicle fields. */
export interface EnquiryWriteBody {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  message: string;
}

/**
 * The enquiry as the API returns it to a submitter.
 *
 * Separate from the staff `Enquiry` type because the two are read for different
 * reasons, and one shared type would invite the staff surface to depend on a
 * confirmation payload. `apiSend` returns a type assertion, so none of this has
 * been checked - a confirmation is a thank-you, not a record anybody acts on.
 */
export interface EnquiryCreated {
  id: string;
  vehicle_id: string;
  vehicle_slug: string;
  status: string;
}

/**
 * Records one enquiry against the vehicle named by `slug`.
 *
 * `session: "omit"` is the default; it is stated explicitly because this is the
 * one call in the application where sending a credential would be a bug rather
 * than dead code.
 *
 * The slug is percent-encoded because it arrives from the page's own path. A
 * `Vehicle.slug` is validated against `SLUG_PATTERN` on write, so a real slug
 * needs no encoding - this guards the route, not the value, and costs nothing.
 */
export function submitEnquiry(
  slug: string,
  body: EnquiryWriteBody,
): Promise<EnquiryCreated> {
  return apiSend<EnquiryCreated>(
    "POST",
    `/vehicles/${encodeURIComponent(slug)}/enquiry`,
    { json: body, session: "omit" },
  );
}
