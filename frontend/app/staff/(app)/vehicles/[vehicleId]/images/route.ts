/**
 * The image upload endpoint for the admin interface.
 *
 * ---------------------------------------------------------------------------
 * Why this is a Route Handler and not a Server Action
 * ---------------------------------------------------------------------------
 * Next caps a Server Action's raw request body at 1 MB by default - `multipart`
 * framing included - and the limit's documented purpose is to stop a large body
 * being parsed into memory. A `<form>` posting straight to an action is still an
 * action request, so it is still capped. The backend accepts ten files of up to
 * 10 MB each, which is a hundred megabytes, and no arrangement of a Server
 * Action carries that.
 *
 * The other option is raising `serverActions.bodySizeLimit` to 100 MB, which the
 * config permits. That was rejected: the cap is there to bound what this process
 * buffers per request, and raising it to a hundred megabytes does that for *every*
 * action in the app to satisfy one screen. A Route Handler has no such cap, and
 * is where Next documents file uploads belonging.
 *
 * ---------------------------------------------------------------------------
 * Why a plain form post, with no JavaScript in the request path
 * ---------------------------------------------------------------------------
 * Because the browser is very good at posting a file, and better at it than
 * anything reimplemented in a `fetch`. The native form post gives real upload
 * progress in the browser's own UI, works if the JavaScript bundle has not
 * loaded yet, and needs no `FormData` to be rebuilt on this side of the wire.
 * The one thing it does not give is `useActionState`, which is why the outcome
 * travels by redirect instead.
 *
 * Losing the typed alt text on a rejected upload costs nothing real, and this is
 * the reason: a browser cannot repopulate a file input from script, so after any
 * failure the *selected files* are already gone from the form regardless of how
 * the upload was arranged. There is no version of this where the staff member
 * keeps their selection, so there is no version that loses something.
 *
 * ---------------------------------------------------------------------------
 * Why this is Post/Redirect/Get
 * ---------------------------------------------------------------------------
 * Because a 200 response to a form post leaves the browser on a URL that would
 * re-post the photographs on refresh. The 303 sends the browser to the editor,
 * which re-runs as a server component - so the gallery the staff member sees is
 * read fresh from the backend, and the refresh that follows is a safe `GET`.
 *
 * Reordering, promoting and deleting stay Server Actions. They post a handful of
 * bytes, and they are the operations that benefit from `useActionState` keeping
 * the rest of the page in place.
 *
 * ---------------------------------------------------------------------------
 * Why the session check throws here and is caught below
 * ---------------------------------------------------------------------------
 * `requireStaffApi` raises a 401 `ApiError` rather than redirecting, which is
 * right for a Server Action - it keeps the staff member's input. This handler
 * *wants* the redirect, because a form post cannot render an error state. So the
 * throw is caught and turned into a redirect to the login form, and the
 * distinction that motivated the throw is simply applied at the boundary.
 */

import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { ApiError } from "@/lib/api/errors";
import { uploadVehicleImages } from "@/lib/api/admin-images";
import { requireStaffApi } from "@/lib/staff/dal";
import { STAFF_LOGIN, staffVehicle } from "@/features/staff/lib/routes";
import {
  IMAGE_ADDED_PARAM,
  IMAGE_POSITION_PARAM,
  IMAGE_PROBLEM_PARAM,
} from "@/features/staff/lib/image-upload-feedback";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_FILES_PER_UPLOAD,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_VEHICLE,
} from "@/features/staff/lib/image-limits";
import type { ImageUploadProblem } from "@/features/staff/lib/image-upload-feedback";

/** Never cache, and never let this be treated as a static route. */
export const dynamic = "force-dynamic";

/**
 * Appends photographs to a vehicle.
 *
 * Always answers with a redirect: to the editor on success, back to the editor
 * with a problem code on failure, or to the login form if the session is gone.
 * There is no path through this function that returns a body.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ vehicleId: string }> },
): Promise<NextResponse> {
  const { vehicleId } = await params;

  // The editor this upload came from. Every exit below redirects here, so a
  // failure cannot leave the staff member on a dead URL - and the vehicle id is
  // from the path, not from the form body, so the form cannot redirect the browser
  // somewhere it should not go.
  const editor = new URL(staffVehicle(vehicleId), request.nextUrl.origin);

  try {
    await requireStaffApi();
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      // 303, not 307, and the distinction is the whole point of this branch.
      //
      // 307 preserves the request method and body. Choosing it would tell the
      // browser to re-issue the *multipart POST* against `/staff/login`, which
      // serves only GET - so the staff member who let their session lapse mid-upload
      // would lose the upload and then land on a 405 page instead of a sign-in
      // form. The photograph bytes would cross the network a second time for
      // nothing.
      //
      // 303 See Other is the correct code whenever a redirect is sent *instead of*
      // processing a request rather than *after* processing one. Nothing was
      // written, and `formData()` below has not been called, so there is no
      // consumed upload to be reconciled with.
      return NextResponse.redirect(new URL(STAFF_LOGIN, request.nextUrl.origin), 303);
    }
    throw error;
  }

  // ---------------------------------------------------------------------------
  // Read the body
  // ---------------------------------------------------------------------------
  // `formData()` parses the multipart body into memory. That is the one thing this
  // route does that a Server Action's 1 MB cap was designed to bound, and it is
  // bounded here instead - by `MAX_IMAGE_BYTES` and `MAX_FILES_PER_UPLOAD` below,
  // checked before any of it is forwarded.
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    // A truncated body lands here. The most common cause is a file larger than
    // the server accepts, or a connection that dropped part-way through, and both
    // are reported the same way because the parser cannot tell them apart.
    return NextResponse.redirect(failed(editor, "unreadable_upload"), 303);
  }

  const files = form
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
  const alts = form
    .getAll("alts")
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""));

  // ---------------------------------------------------------------------------
  // Refuse before forwarding, not after
  // ---------------------------------------------------------------------------
  // The backend re-checks all of this. Checking here is not about safety - it is
  // that a rejection which arrives after the bytes have crossed the network and
  // after the server has decoded every image is a slow way to say "you picked
  // eleven files".

  if (files.length === 0) {
    return NextResponse.redirect(failed(editor, "no_files"), 303);
  }

  if (files.length > MAX_FILES_PER_UPLOAD) {
    return NextResponse.redirect(failed(editor, "too_many_files"), 303);
  }

  // `existing_count` is the number the editor rendered. It is client-supplied, so
  // it is a fast-fail that saves a wasted round trip, not a control - the backend
  // enforces the real per-vehicle cap and will refuse a gallery that is full.
  const claimed = Number(form.get("existing_count"));
  if (Number.isInteger(claimed) && claimed >= 0) {
    if (claimed + files.length > MAX_IMAGES_PER_VEHICLE) {
      return NextResponse.redirect(failed(editor, "too_many_images"), 303);
    }
  }

  // Indexed rather than `files.every`, so the redirect can point at the
  // photograph that is undescribed. Never defaulted from the vehicle's name: that
  // would be a caption nobody wrote about a picture nobody looked at.
  const undescribed = files.findIndex((_, index) => (alts[index] ?? "") === "");
  if (undescribed !== -1) {
    return NextResponse.redirect(
      failed(editor, "missing_alt", undescribed + 1),
      303,
    );
  }

  // Type and size, checked per file so the message is about the right one. Both
  // are enforced by the backend as well; `File.type` is advisory - it is whatever
  // the browser inferred - which is exactly why the backend decodes rather than
  // trusts it.
  for (const file of files) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      return NextResponse.redirect(failed(editor, "not_a_vehicle_image"), 303);
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.redirect(failed(editor, "too_large"), 303);
    }
  }

  // ---------------------------------------------------------------------------
  // Forward
  // ---------------------------------------------------------------------------
  // `uploadVehicleImages` builds the backend's own multipart body, with the part
  // names the API documents (`files` and `alts`) rather than the ones this HTML
  // form happens to use. The browser's field names are a detail of this form; the
  // API's are the contract.
  try {
    const result = await uploadVehicleImages(vehicleId, files, alts);

    revalidatePath(staffVehicle(vehicleId));
    revalidatePath("/inventory");
    revalidatePath("/staff");

    const added = new URL(editor);
    added.searchParams.set(IMAGE_ADDED_PARAM, String(result.created));
    return NextResponse.redirect(added, 303);
  } catch (error) {
    if (error instanceof ApiError) {
      // 422 is the backend's "this file is not a usable photograph" - a corrupt
      // image, a tracking pixel, something below the minimum dimensions. It is
      // mapped to a sentence about photographs rather than to the API's own text,
      // because the API's text names the file in a way the staff member cannot
      // match to anything on screen.
      if (error.status === 401) {
        return NextResponse.redirect(failed(editor, "session_expired"), 303);
      }
      if (error.status === 404) {
        return NextResponse.redirect(failed(editor, "vehicle_not_found"), 303);
      }
      if (error.status === 422) {
        return NextResponse.redirect(failed(editor, "not_a_vehicle_image"), 303);
      }
      if (error.status === 409 || error.status === 413) {
        return NextResponse.redirect(failed(editor, "too_many_images"), 303);
      }
    }
    return NextResponse.redirect(failed(editor, "failed"), 303);
  }
}

/**
 * The editor URL with a problem code attached.
 *
 * Any search already on the editor URL is replaced, so a staff member who
 * followed a stale link does not end up with two problems competing for one
 * message.
 */
function failed(editor: URL, problem: ImageUploadProblem, position?: number): URL {
  const url = new URL(editor);
  url.search = "";
  url.searchParams.set(IMAGE_PROBLEM_PARAM, problem);
  if (position !== undefined) {
    url.searchParams.set(IMAGE_POSITION_PARAM, String(position));
  }
  return url;
}
