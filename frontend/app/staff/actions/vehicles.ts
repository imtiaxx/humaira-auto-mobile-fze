"use server";

/**
 * Vehicle create, edit, archive and restore.
 *
 * ---------------------------------------------------------------------------
 * What the actions are responsible for, and what they are not
 * ---------------------------------------------------------------------------
 * Each action does three things and stops: check the session, parse and check the
 * form, call the API. It does not validate rules - that is
 * `features/staff/lib/vehicle-form.ts`, which is testable on its own - and it does
 * not decide what an error means for the page, which is why the mapping from an
 * `ApiError` to a message lives here rather than being scattered through JSX.
 *
 * ---------------------------------------------------------------------------
 * Why `revalidatePath` rather than local state
 * ---------------------------------------------------------------------------
 * Every mutation here changes something other pages read: the vehicle list, the
 * public inventory, the dashboard counts. Updating one component's state would
 * leave the rest of the application showing the version that was true before the
 * save, which for an archive is the difference between a vehicle that has left
 * sale and one that has not. So the paths that read vehicles are revalidated and
 * the server's answer wins.
 *
 * The public inventory path is revalidated too, deliberately. The admin surface
 * is the only way this data changes, and a vehicle archived here should disappear
 * from the public site immediately rather than when the site happens to
 * revalidate.
 *
 * ---------------------------------------------------------------------------
 * Why archive and restore are not `deleteVehicle` / `undeleteVehicle`
 * ---------------------------------------------------------------------------
 * Because that is what the backend chose, and the names are the argument. There is
 * no `DELETE /vehicles/{id}`: a `DELETE` that quietly archives lies in the HTTP
 * contract, and a `DELETE` that really deletes is a decision that belongs behind
 * its own confirmation and an audit trail. The function names here say what
 * happens to the vehicle, so a reader of this file learns the real behaviour
 * without having to know the endpoint.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/errors";
import {
  archiveVehicle,
  createVehicle,
  restoreVehicle,
  updateVehicle,
  type VehicleWriteBody,
} from "@/lib/api/admin-vehicles";
import { requireStaffApi } from "@/lib/staff/dal";
import { STAFF_HOME, STAFF_VEHICLES, staffVehicle } from "@/features/staff/lib/routes";
import { parseVehicleForm, type VehicleFormValues } from "@/features/staff/lib/vehicle-form";
import type { VehicleFormState } from "@/features/staff/lib/action-state";

/** The public inventory, which an archive or restore changes. */
const PUBLIC_INVENTORY = "/inventory";


/**
 * Turns a write failure into something a form can render.
 *
 * `409` is separated out because it means something different from every other
 * failure and deserves a different sentence: a duplicate slug or VIN is a
 * conflict with a record that already exists, not a bad value. Telling a staff
 * member "choose a different VIN" is more use than "the request was invalid",
 * and it is the difference between a form they can fix and one they cannot.
 */
function writeFailure(error: unknown, values: VehicleFormValues): VehicleFormState {
  if (error instanceof ApiError && error.status === 409) {
    return {
      ok: false,
      message:
        "That URL slug or VIN is already used by another vehicle. Choose a different one.",
      values,
    };
  }

  if (error instanceof ApiError && error.status === 401) {
    return { ok: false, message: "Your session has expired. Sign in again to continue." };
  }

  if (error instanceof ApiError) {
    return { ok: false, message: error.userMessage, values };
  }

  return {
    ok: false,
    message: "The vehicle could not be saved. Please try again.",
    values,
  };
}

/**
 * Adds a vehicle.
 *
 * Redirects to the editor on success rather than back to the list, because a
 * newly added vehicle has no images and the next thing anybody does with it is
 * add some. Landing on the editor makes that the obvious next step; landing on the
 * list makes it a hunt.
 */
export async function createVehicleAction(
  _previous: VehicleFormState,
  form: FormData,
): Promise<VehicleFormState> {
  await requireStaffApi();

  const parsed = parseVehicleForm(form);
  if (!parsed.ok) {
    return { ok: false, message: "Check the highlighted fields.", errors: parsed.errors, values: parsed.values };
  }

  let created: { id: string };
  try {
    created = await createVehicle(parsed.body as VehicleWriteBody);
  } catch (error) {
    return writeFailure(error, parsed.values);
  }

  revalidatePath(STAFF_HOME);
  revalidatePath(STAFF_VEHICLES);
  revalidatePath(PUBLIC_INVENTORY);

  redirect(staffVehicle(created.id));
}

/**
 * Saves a vehicle.
 *
 * The submitted values are returned on failure so the form comes back filled in.
 * That is the whole reason `parseVehicleForm` returns `values` alongside its
 * errors, and the reason this action does not re-read the vehicle to repopulate
 * the form: the staff member's unsaved typing is newer than the stored record, and
 * discarding it in favour of what is in the database would throw away the edit
 * they were in the middle of.
 */
export async function updateVehicleAction(
  vehicleId: string,
  _previous: VehicleFormState,
  form: FormData,
): Promise<VehicleFormState> {
  await requireStaffApi();

  const parsed = parseVehicleForm(form);
  if (!parsed.ok) {
    return { ok: false, message: "Check the highlighted fields.", errors: parsed.errors, values: parsed.values };
  }

  try {
    await updateVehicle(vehicleId, parsed.body as VehicleWriteBody);
  } catch (error) {
    return writeFailure(error, parsed.values);
  }

  revalidatePath(STAFF_HOME);
  revalidatePath(STAFF_VEHICLES);
  revalidatePath(staffVehicle(vehicleId));
  revalidatePath(PUBLIC_INVENTORY);

  // A success value rather than a redirect. The page re-renders from the
  // revalidated path either way, so nothing is gained by a redirect - and
  // redirecting would discard the form, which is what makes "saved" impossible
  // to tell apart from "the page reloaded". Returning it lets the form say so in
  // place, and leaves the staff member's scroll position where it was.
  return { ok: true, message: "Changes saved." };
}

/**
 * Withdraws a vehicle from public sale.
 *
 * No confirmation step is implemented here, and that is a real gap rather than an
 * oversight to be read as a decision: the backend's route description is explicit
 * that irreversibility deserves its own confirmation, and archiving *is*
 * reversible. The editor's button is therefore labelled with what it does
 * ("Archive") rather than "Delete", so nobody is told they are destroying a
 * record.
 */
export async function archiveVehicleAction(vehicleId: string): Promise<void> {
  await requireStaffApi();

  try {
    await archiveVehicle(vehicleId);
  } catch (error) {
    // Thrown rather than returned: this is a button, not a form, so there is no
    // form state to render an error into. The nearest `error.tsx` boundary turns
    // it into a page that says the archive failed, which is honest - the vehicle
    // is still published and pretending otherwise would be the dangerous lie.
    if (error instanceof ApiError) throw error;
    throw new Error("Archiving the vehicle failed.");
  }

  revalidatePath(STAFF_HOME);
  revalidatePath(STAFF_VEHICLES);
  revalidatePath(staffVehicle(vehicleId));
  revalidatePath(PUBLIC_INVENTORY);
}

/** Returns an archived vehicle to public sale. */
export async function restoreVehicleAction(vehicleId: string): Promise<void> {
  await requireStaffApi();

  try {
    await restoreVehicle(vehicleId);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error("Restoring the vehicle failed.");
  }

  revalidatePath(STAFF_HOME);
  revalidatePath(STAFF_VEHICLES);
  revalidatePath(staffVehicle(vehicleId));
  revalidatePath(PUBLIC_INVENTORY);
}
