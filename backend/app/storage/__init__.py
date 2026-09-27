"""Image storage: interface, local-disk implementation, and the factory."""

from __future__ import annotations

from functools import lru_cache

from app.core.config import settings
from app.storage.base import ImageStorage, build_image_key, is_valid_image_key
from app.storage.local import ImageStorageError, LocalImageStorage

__all__ = [
    "ImageStorage",
    "ImageStorageError",
    "LocalImageStorage",
    "build_image_key",
    "get_image_storage",
    "is_valid_image_key",
]


@lru_cache(maxsize=1)
def get_image_storage() -> ImageStorage:
    """Return the configured storage backend.

    Cached, so the root directory is resolved once per process rather than once
    per upload. The `image_storage_backend` switch is a `Literal`, so adding a
    provider means adding a branch here and nothing else.
    """
    if settings.image_storage_backend == "local":
        return LocalImageStorage(
            root=settings.image_storage_root,
            public_base_url=settings.resolved_image_public_base_url,
        )
    raise ValueError(f"Unsupported IMAGE_STORAGE_BACKEND: {settings.image_storage_backend!r}.")
