"""Generic repository base.

Provides the query primitives every future repository needs. No concrete
repositories exist yet - adding them is a later step, when there is real query
behaviour to encapsulate.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any, TypeVar

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository[ModelT: Base]:
    """CRUD primitives scoped to one model type."""

    model: type[ModelT]

    def __init__(self, session: AsyncSession, model: type[ModelT] | None = None) -> None:
        self._session = session
        if model is not None:
            self.model = model
        elif not hasattr(self, "model"):
            raise TypeError(f"{type(self).__name__} must define `model` or pass one to __init__.")

    # --- Reads ------------------------------------------------------------
    def _base_query(self) -> Select[Any]:
        return select(self.model)

    async def get_by_id(self, entity_id: Any) -> ModelT | None:
        return await self._session.get(self.model, entity_id)

    async def list(self, *, limit: int = 50, offset: int = 0) -> Sequence[ModelT]:
        result = await self._session.scalars(self._base_query().limit(limit).offset(offset))
        return result.all()

    async def count(self) -> int:
        result = await self._session.execute(select(func.count()).select_from(self.model))
        return int(result.scalar_one())

    # --- Writes -----------------------------------------------------------
    def add(self, entity: ModelT) -> ModelT:
        self._session.add(entity)
        return entity

    async def flush(self) -> None:
        """Send pending changes so constraint violations surface immediately.

        A `flush` is not a `commit`: it makes the database reject bad data now
        rather than after the service has already reported success, while
        leaving the enclosing transaction open for the handler to finish.
        """
        await self._session.flush()

    async def update(self, entity: ModelT, values: Mapping[str, Any]) -> ModelT:
        """Apply a mapping of column values to a loaded entity and flush it.

        Takes a `Mapping` rather than a `dict` so a `TypedDict` of writable
        columns can be passed directly, which is what makes the write
        allow-lists type-checkable instead of merely conventional.
        """
        for column, value in values.items():
            setattr(entity, column, value)
        await self._session.flush()
        return entity

    async def delete(self, entity: ModelT) -> None:
        """Remove an entity and flush, so the caller sees the effect at once."""
        await self._session.delete(entity)
        await self._session.flush()

    async def get_by(self, **criteria: Any) -> ModelT | None:
        """One row matching every criterion, or `None`."""
        result = await self._session.scalars(select(self.model).filter_by(**criteria))
        return result.first()

    async def list_by(self, **criteria: Any) -> Sequence[ModelT]:
        """Every row matching all criteria, in insertion order."""
        result = await self._session.scalars(select(self.model).filter_by(**criteria))
        return result.all()
