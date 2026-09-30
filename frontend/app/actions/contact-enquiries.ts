"use server";

/**
 * The Contact page's enquiry action.
 *
 * ---------------------------------------------------------------------------
 * Why this exists at all
 * ---------------------------------------------------------------------------
 * The only public write endpoint in the backend is
 * `POST /api/v1/vehicles/{slug}/enquiry`, and `Enquiry.vehicle_id` is
 * `nullable=False`. There is no general "contact us" submission and no way to add
 * one without a schema change and a migration, so an enquiry has to be about a
 * vehicle that exists.
 *
 * That is why the form asks the visitor to choose one. It is a real constraint of
 * the data model rather than a design choice, and the alternative - rendering a
 * form whose submissions are silently discarded - is the one outcome worth
 * refusing at any cost.
 *
 * ---------------------------------------------------------------------------
 * Why this is a wrapper and not a second implementation
 * ---------------------------------------------------------------------------
 * `submitEnquiryAction` already does all of the work worth doing: it validates the
 * four customer fields, calls the API, and turns a 422 into per-field messages, a
 * 409 into "you have already asked", a 404 into "that vehicle has gone" and
 * anything else into "we could not reach the dealership". None of that is worth
 * writing twice, and a second copy would drift from the vehicle detail page's
 * copy within one release.
 *
 * So this adds exactly one thing: the slug. On the detail page it comes from the
 * route and is bound into the action, which is what stops a visitor filing an
 * enquiry about a car the form is not on. Here the visitor picks it in a `<select>`,
 * so it arrives as a form field and has to be read and passed through.
 *
 * ---------------------------------------------------------------------------
 * Why reading the slug from the form is safe
 * ---------------------------------------------------------------------------
 * Because the backend never trusts it. `submit_enquiry` resolves the vehicle with
 * `get_vehicle_by_slug` and raises `NotFoundError` for anything that does not
 * match, so a hand-edited or forged `vehicle_slug` cannot attach an enquiry to a
 * vehicle the visitor was not shown - it produces the 404 the delegated action
 * already handles with a real sentence. The guarantee the vehicle detail page gets
 * from its route holds here too, just enforced downstream instead of by the URL.
 *
 * Re-validating the slug against the page's own vehicle list would duplicate that
 * check to produce an error the backend already gives, and would introduce a
 * second source of truth about which vehicles are selectable.
 */

import { submitEnquiryAction } from "@/app/actions/enquiries";
import {
  parseEnquiryForm,
  type EnquiryFormValues,
} from "@/features/vehicles/lib/enquiry-form";

/**
 * What the Contact form renders.
 *
 * Identical to the vehicle detail page's `EnquiryFormState`, plus `submittedSlug`.
 *
 * The shared state has no way to say which vehicle was picked, because on a detail
 * page the vehicle *is* the route and there is nothing to re-select. Here the pick
 * is a form field, so a rejected submission has to bring it back too - a visitor
 * who is told their email is invalid should not also find their vehicle reset.
 *
 * `EnquiryFormState` is left untouched rather than extended in place: the detail
 * page's form does not need the field, and widening a shared type for one caller
 * makes the next reader wonder what it is for.
 */
export type ContactEnquiryState =
  | {
      ok: false;
      message: string;
      errors?: Record<string, string>;
      values: EnquiryFormValues;
      submittedSlug: string;
    }
  | { ok: true; message: string; submittedSlug: string }
  | null;

/**
 * Submits one enquiry, about the vehicle chosen in the form's `vehicle_slug` field.
 *
 * The "no vehicle chosen" branch is the only behaviour added over the delegated
 * action; every response from it is passed through with the slug attached.
 */
export async function submitContactEnquiryAction(
  _previous: ContactEnquiryState,
  form: FormData,
): Promise<ContactEnquiryState> {
  const raw = form.get("vehicle_slug");
  const slug = typeof raw === "string" ? raw.trim() : "";

  if (slug.length === 0) {
    // `parseEnquiryForm` populates `values` on its failure path as well as its
    // success path, precisely so a rejected submission never costs anyone the
    // message they wrote. It reads the four customer fields and ignores everything
    // else in the `FormData`, so it is safe to call before the vehicle check.
    return {
      ok: false,
      message: "Choose the vehicle your enquiry is about.",
      errors: { vehicle_slug: "Select a vehicle." },
      values: parseEnquiryForm(form).values,
      submittedSlug: "",
    };
  }

  const result = await submitEnquiryAction(slug, _previous, form);
  return result === null ? null : { ...result, submittedSlug: slug };
}