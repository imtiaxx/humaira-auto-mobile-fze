"use server";

/**
 * The public enquiry form's server action.
 *
 * ---------------------------------------------------------------------------
 * Why a Server Action and not a browser fetch
 * ---------------------------------------------------------------------------
 * Three reasons, in order of how much they would have hurt:
 *
 * 1. The API is a different origin. A browser-side POST would need CORS to
 *    permit a write from `localhost:3000` to `localhost:8000`, including a
 *    preflight, and the form's success would depend on the visitor's browser
 *    being able to reach a second origin at all.
 * 2. The backend's address would be in client JavaScript.
 * 3. `lib/api/client.ts` is server-only by design, and widening it to reach the
 *    browser would undo a decision `lib/proxy.ts` and the whole staff surface
 *    depend on.
 *
 * A Server Action is one same-origin request that this server makes on the
 * visitor's behalf. It carries no credential, and it is the same mechanism the
 * staff forms already use.
 *
 * ---------------------------------------------------------------------------
 * Why the backend still gets the last word
 * ---------------------------------------------------------------------------
 * `parseEnquiryForm` runs first and saves a visitor on a fast connection a round
 * trip. It is not the authority. If the API rejects the submission - because the
 * bounds in `features/vehicles/lib/enquiry-form.ts` have drifted from the
 * backend's, or because the vehicle was archived between rendering the page and
 * pressing submit - the 422 is what the visitor is shown, and its per-field
 * messages replace ours.
 */

import { ApiError } from "@/lib/api/errors";
import { submitEnquiry } from "@/lib/api/enquiries";
import {
  fieldErrorsFromDetail,
  parseEnquiryForm,
  type EnquiryFormValues,
} from "@/features/vehicles/lib/enquiry-form";

/**
 * What the enquiry form renders. Mirrors `ActionState` in the staff area.
 *
 * A *type* export from a `"use server"` module is fine - the directive is erased
 * and never reaches the client - but a *value* export is not: every export of such
 * a file must be an async function, and a `const` here fails the build with
 * "Only async functions are allowed to be exported in a 'use server' file". So
 * there is deliberately no `INITIAL_ENQUIRY_STATE` to import, and the component
 * passes `null` inline.
 */
export type EnquiryFormState =
  | { ok: false; message: string; errors?: Record<string, string>; values: EnquiryFormValues }
  | { ok: true; message: string }
  | null;

/**
 * Submits one enquiry about `slug`.
 *
 * `slug` is a bound argument rather than a form field. The form posts to the
 * detail page's own URL, so the vehicle is named by the route and a visitor
 * cannot file an enquiry about a car the form is not on - which is the same
 * guarantee the backend makes by refusing `vehicle_id` in the body.
 */
export async function submitEnquiryAction(
  slug: string,
  _previous: EnquiryFormState,
  form: FormData,
): Promise<EnquiryFormState> {
  const parsed = parseEnquiryForm(form);

  if (!parsed.ok) {
    return {
      ok: false,
      message: "Check the highlighted fields and try again.",
      errors: parsed.errors,
      values: parsed.values,
    };
  }

  const { values } = parsed;

  try {
    await submitEnquiry(slug, {
      customer_name: values.customerName,
      customer_email: values.customerEmail,
      customer_phone: values.customerPhone,
      message: values.message,
    });
  } catch (cause) {
    if (cause instanceof ApiError) {
      // A 422 is the backend rejecting specific fields, and it is the one error
      // worth translating field-by-field. Its per-field messages replace ours,
      // so a visitor is never shown "looks fine here" next to a control the
      // server has already refused.
      if (cause.status === 422) {
        const errors = fieldErrorsFromDetail(cause.details);
        if (Object.keys(errors).length > 0) {
          return {
            ok: false,
            message: "Check the highlighted fields and try again.",
            errors,
            values,
          };
        }
      }

      // 409 means this customer already has an enquiry on this vehicle. That is a
      // *success* from the dealership's point of view - their message is in the
      // backlog - but it is not something the form can claim to have just done, so
      // it gets its own sentence rather than the generic 409 text from
      // `userMessage`. Telling somebody who already asked a question that the
      // request "could not be completed" invites them to try again, and every
      // retry is another 409.
      if (cause.status === 409) {
        return {
          ok: false,
          message:
            "You have already asked about this vehicle - your message is with the dealership.",
          values,
        };
      }

      // 404 means the vehicle is gone - archived, or never there. Worth its own
      // sentence, because the visitor has not done anything wrong and retrying
      // will not help; they need to be sent to the inventory.
      if (cause.status === 404) {
        return {
          ok: false,
          message:
            "This vehicle is no longer available. Browse the current inventory instead.",
          values,
        };
      }

      return { ok: false, message: cause.userMessage, values };
    }

    return {
      ok: false,
      message:
        "We could not reach the dealership just now. Please try again in a moment.",
      values,
    };
  }

  return {
    ok: true,
    message:
      "Thank you. Your enquiry has been sent to the dealership and someone will be in touch.",
  };
}
