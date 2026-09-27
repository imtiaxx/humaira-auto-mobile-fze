"""Vehicle image repository.

Split from `VehicleRepository` because the two manage different tables, and
because `BaseRepository` is generic in its model: a `VehicleRepository` cannot
legitimately be handed a `VehicleImage`. Every image lookup here is scoped by
`vehicle_id` as well as the image's own id, so an identifier belonging to one
vehicle is indistinguishable from one that does not exist when it is offered
against another.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence

from sqlalchemy import func, select

from app.db.models.vehicle import VehicleImage
from app.repositories.base import BaseRepository


class VehicleImageRepository(BaseRepository[VehicleImage]):
    """Reads and writes for `vehicle_images`."""

    model = VehicleImage

    async def list_for_vehicle(self, vehicle_id: uuid.UUID) -> Sequence[VehicleImage]:
        """Every photograph on a vehicle, in display order."""
        result = await self._session.scalars(
            select(VehicleImage)
            .where(VehicleImage.vehicle_id == vehicle_id)
            .order_by(VehicleImage.position)
        )
        return result.all()

    async def get_for_vehicle(
        self,
        vehicle_id: uuid.UUID,
        image_id: uuid.UUID,
    ) -> VehicleImage | None:
        """One photograph, scoped to its vehicle."""
        result = await self._session.scalars(
            select(VehicleImage).where(
                VehicleImage.id == image_id,
                VehicleImage.vehicle_id == vehicle_id,
            )
        )
        return result.first()

    async def count_for_vehicle(self, vehicle_id: uuid.UUID) -> int:
        """How many photographs a vehicle already has."""
        result = await self._session.execute(
            select(func.count())
            .select_from(VehicleImage)
            .where(VehicleImage.vehicle_id == vehicle_id)
        )
        return int(result.scalar_one())

    async def next_position(self, vehicle_id: uuid.UUID) -> int:
        """The position a newly appended photograph should take.

        Derived from the highest existing position, not the row count, so it stays
        correct after a deletion has left a gap. The result is always >= 0: an
        empty gallery yields 0, which is the primary slot.
        """
        highest = await self._session.scalar(
            select(func.max(VehicleImage.position)).where(VehicleImage.vehicle_id == vehicle_id)
        )
        return 0 if highest is None else int(highest) + 1

    async def count_all(self) -> int:
        """Total photographs across every vehicle, archived or not."""
        result = await self._session.execute(select(func.count()).select_from(VehicleImage))
        return int(result.scalar_one())
