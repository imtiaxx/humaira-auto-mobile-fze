/**
 * Admin image endpoint bindings.
 *
 * ---------------------------------------------------------------------------
 * Why this file is separate from `admin-vehicles.ts`
 * ---------------------------------------------------------------------------
 * Because its one request is not JSON. Uploading photographs means
 * `multipart/form-data` with repeated `files` and repeated `alts` parts, and a
 * binding module that declared "a vehicle is written as JSON" would either grow a
 * second transport or quietly send a `Content-Type` header that destroys the
 * multipart boundary. Keeping the shape of the request visible in the shape of
 * the module means the seam is auditable at a glance.
 *
 * ---------------------------------------------------------------------------
 * The multipart boundary, in one paragraph
 * ---------------------------------------------------------------------------
 * `fetch` sets `Content-Type: multipart/form-data; boundary=...` itself when the
 * body is a `FormData`, and the boundary is generated per request. Setting the
 * header by hand replaces the generated one with a boundary the body does not
 * contain, and the backend then fails to parse it - a 422 that blames the
 * photograph rather than the header. `lib/api/client.ts` therefore sets
 * `Content-Type` only on the JSON path, and this file passes the `FormData`
 * through untouched.
 *
 * ---------------------------------------------------------------------------
 * Ordering is a whole list, not a move
 * ---------------------------------------------------------------------------
 * `reorderVehicleImages` takes every image id in the order they should appear,
 * rather than a `move(imageId, toPosition)` instruction. The backend rejects a
 * list that repeats or omits an id, so there is no way to leave a gallery in a
 * half-applied state. That matters for the reason the endpoint description gives:
 * two staff members reordering the same gallery is not a hypothetical, and a
 * move instruction is ambiguous the moment the second request resolves against an
 * order the first has already replaced.
 */

import { apiSend, UPLOAD_TIMEOUT_MS } from "@/lib/api/client";
import type { StaffVehicleImageRecord } from "@/lib/api/admin-vehicles";

/** The gallery after a reorder or a primary-image change. */
export interface ImageOrderResult {
  images: StaffVehicleImageRecord[];
}

/** The gallery after one or more appends. */
export interface ImageUploadResult {
  images: StaffVehicleImageRecord[];
  /** How many images *this request* added, not the gallery size. */
  created: number;
}

/** Acknowledgement of a deletion. */
export interface ImageDeleteResult {
  deleted: string;
  /** The remaining gallery, renumbered contiguously from 0. */
  images: StaffVehicleImageRecord[];
}

/**
 * Appends photographs to a vehicle.
 *
 * Alt text is sent as one `alts` part per file, in the same order as `files`.
 * It is required, and the backend rejects the whole request if any description is
 * missing - a photograph with no alt text is invisible to a screen reader, and
 * the alternative, inventing a caption from the vehicle's name, would be a claim
 * about an image nobody looked at.
 *
 * Uploads *append*. New images land after the existing ones so that adding a
 * photograph does not silently change which one leads the listing; promoting a
 * different lead is a separate, deliberate action.
 *
 * @param files - The images to add. Must preserve order relative to `alts`.
 * @param alts - One description per file, same order and length.
 */
export function uploadVehicleImages(
  vehicleId: string,
  files: File[],
  alts: string[],
): Promise<ImageUploadResult> {
  const form = new FormData();
  files.forEach((file, index) => {
    form.append("files", file);
    form.append("alts", alts[index] ?? "");
  });

  return apiSend<ImageUploadResult>(
    "POST",
    `/admin/vehicles/${encodeURIComponent(vehicleId)}/images`,
    {
      form,
      session: "forward",
      // Uploads carry up to ten 10 MB files that the backend re-encodes on the
      // way in, so the default read timeout would fail a request that was in fact
      // working - and an upload whose bytes arrived but whose confirmation did not
      // is how duplicate photographs happen.
      timeoutMs: UPLOAD_TIMEOUT_MS,
    },
  );
}

/**
 * Sets the complete display order.
 *
 * The first id becomes the primary photograph, so "make this one lead" is a
 * reorder with one entry moved to the front - which is why there is no separate
 * "move to position N" call here for the UI to get subtly wrong.
 */
export function reorderVehicleImages(
  vehicleId: string,
  imageIds: string[],
): Promise<ImageOrderResult> {
  return apiSend<ImageOrderResult>(
    "PUT",
    `/admin/vehicles/${encodeURIComponent(vehicleId)}/images/order`,
    { json: { image_ids: imageIds }, session: "forward" },
  );
}

/**
 * Promotes one photograph to position 0, shifting the rest down in order.
 *
 * A convenience over `reorderVehicleImages` for the common case. The backend
 * keeps both, and this one earns its place in the UI: making a client reassemble
 * the entire order to express "put this one first" is a chance to get it wrong.
 */
export function setPrimaryImage(
  vehicleId: string,
  imageId: string,
): Promise<ImageOrderResult> {
  return apiSend<ImageOrderResult>(
    "POST",
    `/admin/vehicles/${encodeURIComponent(vehicleId)}/images/${encodeURIComponent(imageId)}/primary`,
    { session: "forward" },
  );
}

/**
 * Deletes one photograph and closes the gap it leaves.
 *
 * The backend commits the row removal before unlinking the bytes, so a failure
 * at the last step cannot leave a live row pointing at a file that is gone. The
 * returned gallery is already renumbered from 0, so the caller can replace its
 * state with it rather than recomputing positions itself.
 */
export function deleteVehicleImage(
  vehicleId: string,
  imageId: string,
): Promise<ImageDeleteResult> {
  return apiSend<ImageDeleteResult>(
    "DELETE",
    `/admin/vehicles/${encodeURIComponent(vehicleId)}/images/${encodeURIComponent(imageId)}`,
    { session: "forward" },
  );
}
