/**
 * The backend's image limits, mirrored on this side.
 *
 * ---------------------------------------------------------------------------
 * Why this is its own module
 * ---------------------------------------------------------------------------
 * Three reasons, and the second is why it is not simply a section of
 * `vehicle-form.ts`.
 *
 * First, these are not form details. They are a contract with the backend - the
 * `image_max_bytes`, `image_max_files_per_request` and `image_max_per_vehicle`
 * settings in `app/core/config.py` - and three different places need them: the
 * upload form, the upload Route Handler, and the sentences shown when a limit is
 * hit. One definition means the three cannot disagree.
 *
 * Second, and decisively, `vehicle-form.ts` is a heavy module that the upload
 * feedback logic would otherwise have to import in order to name a number. That
 * dependency would be backwards, and it would make the feedback logic untestable
 * under `node --test`, which cannot resolve the `@/` alias. This file has no
 * imports at all, so anything can depend on it.
 *
 * Third, a limit that the UI enforces and the API enforces should be obviously the
 * same number. Keeping them adjacent to a comment naming the setting they mirror
 * is what makes a backend change greppable from here.
 *
 * ---------------------------------------------------------------------------
 * These are affordances, not controls
 * ---------------------------------------------------------------------------
 * Every limit below is re-checked by the backend, and its check is the one that
 * counts. The copies here exist to fail fast and to say something useful - a
 * control that disables itself is better than one that uploads a hundred megabytes
 * to be told no. A stale number in this file produces a confusing message, never a
 * security hole.
 */

/** How many files one upload request may carry. Mirrors `image_max_files_per_request`. */
export const MAX_FILES_PER_UPLOAD = 10;

/** How many images one vehicle may hold in total. Mirrors `image_max_per_vehicle`. */
export const MAX_IMAGES_PER_VEHICLE = 30;

/** The ceiling on one file, in bytes. Mirrors `image_max_bytes`. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/**
 * The media types the backend accepts.
 *
 * The same three it will decode, and deliberately *not* the full set of formats a
 * browser can name. A `.heic` from a phone is a real problem for a dealership
 * photograph, and pretending otherwise here would only move the failure from the
 * file input to an upload that is refused after the bytes have crossed the network.
 *
 * The backend decodes the file rather than trusting this list, so a `type` that
 * lies is still caught - this only decides which files are offered in the first
 * place.
 */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
