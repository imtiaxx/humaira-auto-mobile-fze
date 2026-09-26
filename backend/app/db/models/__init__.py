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

Planned entities - deliberately **not** defined yet, so that their schema can
be reviewed against real business requirements before it is frozen into a
migration history: Customer, Vehicle, VehicleImage, VehicleFeature,
VehicleInquiry, SavedVehicle, VehicleComparison, ExportRequest, Quote, Lead,
Notification, AuditLog.
"""

from __future__ import annotations

from app.db.base import Base
from app.db.models.user import User

#: Every mapped class, exported for convenient imports and test collection.
ALL_MODELS: tuple[type[Base], ...] = (User,)


def import_models() -> tuple[type[Base], ...]:
    """Import all model modules and return them.

    Called by the Alembic environment. Safe to call repeatedly.
    """
    return ALL_MODELS


__all__ = ["ALL_MODELS", "Base", "User", "import_models"]
