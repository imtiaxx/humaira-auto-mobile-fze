"""Image storage interface.

Vehicle photographs are real files. PostgreSQL holds their metadata - URL,
dimensions, ordering, alt text - and nothing else, because a table of
multi-megabyte blobs is a table nobody can back up, replicate or page through.

This module defines the seam. `LocalImageStorage` is the only implementation
that ships, and it is deliberately dull: bytes go to a directory on disk. What
buys the business a way out later is that every caller talks to this interface,
so an S3, GCS or Azure backend becomes one more class rather than a rewrite of
the image service, the endpoints and the tests.

Nothing here knows about the web framework, the database, or vehicles.
"""

from __future__ import annotations

import re
import uuid
from abc import ABC, abstractmethod
from datetime import UTC, datetime
from typing import Final

#: Storage keys this project generates look exactly like this. Validating a key
#: against a strict pattern before it ever reaches the filesystem is what makes
#: path traversal structurally impossible rather than merely unlikely: a key
#: containing `..`, a leading slash, a backslash or a NUL byte cannot match.
IMAGE_KEY_PATTERN: Final[re.Pattern[str]] = re.compile(
    r"^(?P<shard>\d{4}/\d{2})/(?P<name>[a-f0-9]{32})\.(?P<extension>jpg|png|webp)$"
)


def build_image_key(extension: str, *, now: datetime | None = None) -> str:
    """Return a fresh, server-generated storage key for a new image.

    The caller's filename is never part of the key. A user-supplied name is
    attacker-controlled: it can contain traversal sequences, a second extension
    (``car.jpg.php``), a NUL byte, or 4 KB of text that ends up in a URL. So the
    key is a random 128-bit hex digest, the extension comes from the format
    *Pillow detected* rather than from the upload, and the directory is sharded
    by month so one directory never holds every image in the system.
    """
    if extension not in {"jpg", "png", "webp"}:
        raise ValueError(f"Unsupported image extension: {extension!r}.")
    moment = now or datetime.now(UTC)
    return f"{moment:%Y/%m}/{uuid.uuid4().hex}.{extension}"


def is_valid_image_key(key: str) -> bool:
    """Return `True` when `key` has the exact shape this project generates."""
    return IMAGE_KEY_PATTERN.fullmatch(key) is not None


class ImageStorage(ABC):
    """Persistence for image bytes.

    Implementations must treat `key` as opaque and untrusted, and must never
    write outside their configured root.
    """

    @abstractmethod
    async def save(self, key: str, data: bytes) -> str:
        """Persist `data` under `key` and return the public URL."""

    @abstractmethod
    async def delete(self, key: str) -> bool:
        """Remove `key`. Returns `True` when a file was actually removed."""

    @abstractmethod
    async def exists(self, key: str) -> bool:
        """Return `True` when `key` currently holds a stored object."""

    @abstractmethod
    def public_url(self, key: str) -> str:
        """Return the URL a browser should use to fetch `key`."""

    @abstractmethod
    def open(self, key: str) -> bytes:
        """Return the stored bytes for `key`."""
