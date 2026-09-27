import type { Metadata } from "next";

import { createVehicleAction } from "@/app/staff/actions/vehicles";
import { requireStaff } from "@/lib/staff/dal";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { Surface } from "@/components/ui/surface";
import { VehicleForm } from "@/features/staff/components/vehicle-form";
import { emptyVehicleFormValues } from "@/features/staff/lib/vehicle-form";

/**
 * Add a vehicle.
 *
 * ---------------------------------------------------------------------------
 * Why this form has no image controls
 * ---------------------------------------------------------------------------
 * Because a vehicle has to exist before it has an id, and the image routes are all
 * `/admin/vehicles/{id}/images`. The backend's create description says the same
 * thing: "Images are managed separately, through this vehicle's `/images`
 * routes."
 *
 * So the create action redirects to the editor, which owns the gallery. That is
 * also the better destination on its own terms - a newly added vehicle has no
 * photographs, and the next thing anybody does with it is add some. Landing on
 * the editor makes that the obvious next step; landing back on the list makes it
 * a hunt through rows.
 */
export const metadata: Metadata = {
  title: "Add a vehicle",
};

export default async function NewVehiclePage() {
  // Called here as well as in the layout, for the reason given on the dashboard:
  // a page that is only safe because of its parent is one refactor away from not
  // being safe. `requireStaff` is memoised per render, so this costs nothing.
  await requireStaff();

  return (
    <Container className="py-10">
      <div className="mb-8 max-w-2xl">
        <SectionHeading
          title="Add a vehicle"
          description="Every field is saved together. You can add photographs on the next screen."
        />
      </div>

      {/*
        A `max-w-3xl` form inside the container. A vehicle form is pairs of short
        labelled inputs; at full container width on a large screen each field
        would be several hundred pixels of input for a value like "Petrol", which
        makes the form harder to scan rather than easier.
      */}
      <Surface className="max-w-3xl p-6">
        <VehicleForm
          action={createVehicleAction}
          initialValues={emptyVehicleFormValues()}
          submitLabel="Create vehicle"
          pendingLabel="Creating"
        />
      </Surface>
    </Container>
  );
}
