"use server";

/**
 * Staff enquiry status changes.
 *
 * ---------------------------------------------------------------------------
 * Why this is a mutation and not a link with a query string
 * ---------------------------------------------------------------------------
 * Because it changes something on the server. A `GET` that writes is a request any
 * prefetcher, crawler or browser extension can fire by following a link, and the
 * `prefetch={false}` on the staff nav is a mitigation for the pages, not a
 * guarantee. A form posting to a Server Action cannot be navigated to and cannot
 * be triggered by anything that merely looks at the page.
 *
 * ---------------------------------------------------------------------------
 * Why one action for all three transitions
 * ---------------------------------------------------------------------------
 * The backend leaves the transition unconstrained in both directions, on the
 * stated grounds that a mis-click should be undoable. So there is no
 * state machine here to encode and no per-transition action to get wrong - a
 * `newStatus` argument is the whole of it. Writing `answerEnquiryAction` and
 * `closeEnquiryAction` and `reopenEnquiryAction` separately would be three names
 * for one behaviour, and would need updating in step with each other every time
 * the enum grew a fourth value.
 *
 * ---------------------------------------------------------------------------
 * Why the value is validated here and not read from the form
 * ---------------------------------------------------------------------------
 * The `status` is a bound argument, not a `FormData` field. That is deliberate
 * twice over: the button posts the value the *server* rendered, so a tampered
 * form field cannot ask for a status this admin does not have, and the argument
 * cannot be silently dropped by a refactor that forgets to read it. The check
 * below is belt-and-braces on top of the backend's `EnquiryStatusUpdate`.
 */

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/errors";
import { updateEnquiryStatus } from "@/lib/api/admin-enquiries";
import { requireStaffApi } from "@/lib/staff/dal";
import { STAFF_ENQUIRIES } from "@/features/staff/lib/routes";
import { ENQUIRY_STATUSES, type EnquiryStatus } from "@/types/enquiry";

/** The detail page, as a `revalidatePath` argument. */
const ENQUIRY_DETAIL = "/staff/enquiries/[enquiryId]";

/** Narrows an unvalidated value to a status, or rejects it. */
function isStatus(value: string): value is EnquiryStatus {
  return (ENQUIRY_STATUSES as readonly string[]).includes(value);
}

/**
 * Moves an enquiry to `newStatus`.
 *
 * The session is checked first, before anything else. `requireStaffApi` throws a
 * `401` `ApiError` rather than redirecting, because this is invoked from a form
 * and a redirect would replace the page the staff member is reading with a login
 * form - losing the enquiry they were in the middle of.
 *
 * Rejects with an `ApiError` on failure so the nearest `error.tsx` boundary can
 * show it. That is the right failure for a button with no state to render into,
 * and it matches `archiveVehicleAction`.
 */
export async function updateEnquiryStatusAction(
  enquiryId: string,
  newStatus: string,
): Promise<void> {
  await requireStaffApi();

  if (!isStatus(newStatus)) {
    // Unreachable through the UI - the button can only send one of the three -
    // but a status the admin does not know would render as an unstyled row, and
    // failing here names the cause instead of showing a mystery later.
    throw new ApiError({
      kind: "http",
      status: 422,
      code: "unknown_status",
      message: "That is not a status this admin recognises.",
    });
  }

  try {
    await updateEnquiryStatus(enquiryId, newStatus);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error("Updating the enquiry's status failed.");
  }

  // Both paths, because a status is visible in two places at once. The detail
  // page shows the badge and the list shows the row; revalidating one leaves the
  // other showing the value the enquiry used to have, which is worse than a
  // slightly stale badge because it looks correct.
  revalidatePath(STAFF_ENQUIRIES);
  revalidatePath(ENQUIRY_DETAIL);
}
