/**
 * How an image upload reports its outcome across a redirect.
 *
 * ---------------------------------------------------------------------------
 * Why the upload is a Route Handler and not a Server Action
 * ---------------------------------------------------------------------------
 * Next applies a `serverActions.bodySizeLimit` of 1 MB to the *raw request body*,
 * multipart framing included - the documented purpose is to stop a large body
 * being parsed into memory. A form input that posts straight to a Server Action
 * is still an action request, so it is still subject to that limit. The backend
 * accepts ten files of up to 10 MB each, so a legitimate upload is up to a
 * hundred megabytes, and a Server Action cannot carry it.
 *
 * The alternative was raising the limit to 100 MB, which the config also allows.
 * That was rejected: the limit exists to bound how much this process will buffer
 * per request, and lifting it to a hundred megabytes applies that to *every*
 * action endpoint in the app, on the strength of one screen's requirement.
 *
 * A Route Handler has no such limit, and it is the documented home for file
 * uploads. The trade is that this one mutation is not a Server Action: it posts a
 * form, and reports its result by redirecting.
 *
 * ---------------------------------------------------------------------------
 * Why a redirect, and why these codes
 * ---------------------------------------------------------------------------
 * Post/Redirect/Get. The handler answers with a 303 to the editor, so a refresh
 * cannot re-post the photographs, and the redirect is what re-runs the server
 * component - which is where the new gallery comes from.
 *
 * The outcome travels in the query string as one of a fixed set of codes rather
 * than as a message. Two reasons, and the second is the important one: a message
 * in a URL ends up in browser history, in the `Referer` of any outbound link, and
 * in server logs; and a code is a closed set the page can exhaustively map to text,
 * so nothing the backend says about a file is ever reflected into the page. The
 * page renders wording written here.
 */

// Relative, with the extension. The alias is used everywhere else in the app and
// is correct there, but `node --test` loads this file directly, and Node's test
// runner is not Next's bundler: it does not read `tsconfig.json`'s `paths`, so an
// `@/` specifier resolves as a package name and throws. See the same note in
// `features/vehicles/lib/vehicle-schema.ts`.
import {
  MAX_FILES_PER_UPLOAD,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_VEHICLE,
} from "./image-limits.ts";

/** Every way an upload can end. `null` when nothing went wrong. */
export type ImageUploadProblem =
  | "no_files"
  | "too_many_files"
  | "too_many_images"
  | "missing_alt"
  | "unreadable_upload"
  | "not_a_vehicle_image"
  | "too_large"
  | "vehicle_not_found"
  | "session_expired"
  | "failed";

/** Query parameter carrying the problem. */
export const IMAGE_PROBLEM_PARAM = "image_problem";

/**
 * Query parameter carrying a one-based photograph position, for `missing_alt`.
 *
 * Separate from the code because it is a number, and validated as one at the
 * point of use - a hand-edited URL should not be able to make the page claim
 * photograph 999999999 needs a description.
 */
export const IMAGE_POSITION_PARAM = "image_at";

/** Query parameter carrying how many photographs were added, for the confirmation. */
export const IMAGE_ADDED_PARAM = "images_added";

/**
 * The wording for one problem.
 *
 * A `switch` over a union with no `default`, so adding a code to the union
 * without writing the sentence for it is a type error rather than a blank
 * message in front of a staff member.
 */
export function imageProblemMessage(
  problem: ImageUploadProblem,
  position: number | null,
): string {
  switch (problem) {
    case "no_files":
      return "Choose at least one photograph to upload.";

    case "too_many_files":
      return `Upload at most ${MAX_FILES_PER_UPLOAD} photographs at a time.`;

    case "too_many_images":
      return `A vehicle can hold at most ${MAX_IMAGES_PER_VEHICLE} photographs. Remove one first.`;

    case "missing_alt":
      return position === null
        ? "Every photograph needs a description."
        : `Photograph ${position} needs a description. Alt text is what a screen reader reads, and it cannot be guessed from a filename.`;

    case "unreadable_upload":
      return "The upload could not be read. This usually means it was larger than the server accepts, or the connection dropped part-way through.";

    case "not_a_vehicle_image":
      return "One of the files is not a JPEG, PNG or WebP image, or is too small to be a photograph of a vehicle.";

    case "too_large":
      return `Each photograph must be ${MAX_IMAGE_BYTES / (1024 * 1024)} MB or smaller.`;

    case "vehicle_not_found":
      return "That vehicle no longer exists.";

    case "session_expired":
      return "Your session expired before the upload finished. Sign in again, then add the photographs again - the files are not kept.";

    case "failed":
      return "The photographs could not be added. Please try again.";
  }
}

/**
 * Parses the `image_problem` parameter.
 *
 * `null` for an absent or unrecognised value, so a hand-edited or stale query
 * string cannot put an unknown code in front of a staff member. The check is a
 * membership test against the union's runtime member, which is what makes the
 * `switch` in `imageProblemMessage` exhaustive.
 */
export function parseImageProblem(value: string | null | undefined): ImageUploadProblem | null {
  if (value === null || value === undefined) return null;

  const known: readonly string[] = [
    "no_files",
    "too_many_files",
    "too_many_images",
    "missing_alt",
    "unreadable_upload",
    "not_a_vehicle_image",
    "too_large",
    "vehicle_not_found",
    "session_expired",
    "failed",
  ];

  return known.includes(value) ? (value as ImageUploadProblem) : null;
}

/**
 * Parses the one-based photograph position, or `null`.
 *
 * Bounded to a plausible range so a hand-edited URL cannot produce "photograph
 * 2147483647 needs a description". Anything outside it is treated as absent,
 * which degrades to the vaguer but still true message.
 */
export function parseImagePosition(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  if (parsed < 1 || parsed > MAX_FILES_PER_UPLOAD) return null;

  return parsed;
}
