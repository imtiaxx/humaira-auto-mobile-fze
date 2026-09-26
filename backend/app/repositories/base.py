"""Generic repository base.

Provides the query primitives every future repository needs. No concrete
repositories exist yet - adding them is a later step, when there is real query
behaviour to encapsulate.
"""

from __future__ import annotations

from collections.abc import Sequence
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
        await self._session.flush()
