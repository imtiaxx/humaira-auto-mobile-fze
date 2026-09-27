"use server";

/**
 * Vehicle image reordering, promotion and deletion.
 *
 * ---------------------------------------------------------------------------
 * Why uploading is *not* in this file
 * ---------------------------------------------------------------------------
 * Because Next caps a Server Action's raw request body at 1 MB, multipart framing
 * included, and the backend accepts ten files of up to 10 MB each. A form input
 * that posts straight to an action is still an action request, so it is still
 * capped - there is no form arrangement that gets a hundred megabytes through.
 *
 * Uploads therefore go to a Route Handler, at
 * `app/staff/(app)/vehicles/[vehicleId]/images/route.ts`, and report their outcome
 * by redirecting. The reasoning, and the rejected alternative of raising
 * `bodySizeLimit` for the whole app, are in that file's comment.
 *
 * The three operations here post a handful of bytes, and they stay Server Actions
 * because that is the better tool for them: `useActionState` reports a failure in
 * place, and the rest of the page stays put.
 *
 * ---------------------------------------------------------------------------
 * Why every mutation revalidates the vehicle
 * ---------------------------------------------------------------------------
 * Because all three change the gallery, and the gallery is rendered by the editor,
 * the public detail page and the vehicle card. Deleting the lead photograph in
 * particular promotes the next one, so a stale list would show a vehicle whose
 * primary image no longer exists. The server's answer is the truth, so the path is
 * revalidated and the local copy discarded.
 *
 * ---------------------------------------------------------------------------
 * Why failures are thrown here and returned by the upload route
 * ---------------------------------------------------------------------------
 * Because these are called directly from a client component, so there is no action
 * state to return a message through - a `throw` reaches the nearest error
 * boundary, and `reorderImagesAction` is the one exception, since it is a form
 * submit and does have somewhere to put a message.
 */

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/errors";
import {
  deleteVehicleImage,
  reorderVehicleImages,
  setPrimaryImage,
} from "@/lib/api/admin-images";
import { requireStaffApi } from "@/lib/staff/dal";
import { staffVehicle } from "@/features/staff/lib/routes";
import type { ImageActionState } from "@/features/staff/lib/action-state";

/** The editor, and the public page that shows the same gallery. */
function revalidateGallery(vehicleId: string): void {
  revalidatePath(staffVehicle(vehicleId));
  revalidatePath("/inventory");
  revalidatePath("/staff");
}

function imageFailure(error: unknown): ImageActionState {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return { ok: false, message: "Your session has expired. Sign in again to continue." };
    }
    if (error.status === 404) {
      return { ok: false, message: "That vehicle no longer exists." };
    }
    return { ok: false, message: error.userMessage };
  }
  return { ok: false, message: "The photographs could not be updated. Please try again." };
}

/**
 * Saves a new display order.
 *
 * The form posts the complete list of image ids rather than a move instruction,
 * matching the backend's contract. A move is ambiguous the moment two staff
 * members reorder the same gallery, and the second request would be resolving
 * against an order the first had already replaced.
 */
export async function reorderImagesAction(
  vehicleId: string,
  _previous: ImageActionState,
  form: FormData,
): Promise<ImageActionState> {
  await requireStaffApi();

  const ids = form
    .getAll("image_id")
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry !== "");

  if (ids.length === 0) {
    return { ok: false, message: "There are no photographs to reorder." };
  }

  if (new Set(ids).size !== ids.length) {
    return { ok: false, message: "Each photograph must appear only once in the order." };
  }

  try {
    await reorderVehicleImages(vehicleId, ids);
  } catch (error) {
    return imageFailure(error);
  }

  revalidateGallery(vehicleId);
  return { ok: true, message: "Photograph order saved." };
}

/** Promotes one photograph to the lead position. */
export async function setPrimaryImageAction(
  vehicleId: string,
  imageId: string,
): Promise<void> {
  await requireStaffApi();

  try {
    await setPrimaryImage(vehicleId, imageId);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error("Promoting the photograph failed.");
  }

  revalidateGallery(vehicleId);
}

/**
 * Deletes one photograph.
 *
 * The backend commits the row removal before it unlinks the bytes, so a failure
 * at the last step cannot leave a live row pointing at a file that is gone. If
 * the deleted photograph was the lead, the next one takes over and the returned
 * gallery is already renumbered from 0 - which is why this revalidates rather
 * than patching the local list.
 *
 * Thrown rather than returned for the same reason as archive: there is no form
 * state to render into, and a failure that is swallowed here would leave a
 * photograph on screen that the staff member believes they deleted.
 */
export async function deleteImageAction(vehicleId: string, imageId: string): Promise<void> {
  await requireStaffApi();

  try {
    await deleteVehicleImage(vehicleId, imageId);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error("Deleting the photograph failed.");
  }

  revalidateGallery(vehicleId);
}
