"""ORM model registry.

Alembic's ``env.py`` calls :func:`import_models` so that autogenerate compares
against the complete model set. **Every new model module must be imported here
or autogenerate will silently skip its table.**

Adding a model in a later step:

1. Create ``app/db/models/<entity>.py`` with one declarative class per table,
   inheriting :class:`~app.db.base.Base` (plus the mixins it needs).
2. Import the class in this module.
3. Run ``alembic revision --autogenerate -m "..."`` and review the output
   before committing. Autogenerate is a starting point, not a guarantee.

Implemented entities:

- ``User`` - identity only. See :mod:`app.db.models.user`.
- ``StaffSession`` - server-side staff sessions. See
  :mod:`app.db.models.staff_session`.
- ``Vehicle`` / ``VehicleImage`` - public inventory. See
  :mod:`app.db.models.vehicle`.

Planned entities - deliberately **not** defined yet, so that their schema can
be reviewed against real business requirements before it is frozen into a
migration history: Customer, VehicleInquiry, SavedVehicle, VehicleComparison,
ExportRequest, Quote, Lead, Notification, AuditLog. `VehicleFeature` is also
not a table - see the note in :mod:`app.db.models.vehicle` on why features are a
column rather than a table.
"""

from __future__ import annotations

from app.db.base import Base
from app.db.models.staff_session import StaffSession
from app.db.models.user import User
from app.db.models.vehicle import Vehicle, VehicleImage

#: Every mapped class, exported for convenient imports and test collection.
ALL_MODELS: tuple[type[Base], ...] = (User, StaffSession, Vehicle, VehicleImage)


def import_models() -> tuple[type[Base], ...]:
    """Import all model modules and return them.

    Called by the Alembic environment. Safe to call repeatedly.
    """
    return ALL_MODELS


__all__ = [
    "ALL_MODELS",
    "Base",
    "StaffSession",
    "User",
    "Vehicle",
    "VehicleImage",
    "import_models",
]
