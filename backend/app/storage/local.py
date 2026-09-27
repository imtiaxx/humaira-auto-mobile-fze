"""Local-disk image storage.

The default `ImageStorage`. Bytes land under a configured root, sharded by month,
and are served by the API's own `/media` mount. No cloud provider, no
credential, no SDK - the only external requirement is a writable directory and a
process that is allowed to keep it.

Two rules make this safe to point at a real filesystem:

1. Every key is matched against `IMAGE_KEY_PATTERN` before it is touched.
2. The resolved path is then checked to be inside the root.

Either check alone would be enough against `../`; both are present because the
first also rejects absurd lengths, odd extensions and absolute paths *before*
any path arithmetic happens, and the second is the property that actually
matters - that a byte written by this class is a byte the web server can serve.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from app.core.logging import get_logger
from app.storage.base import ImageStorage, is_valid_image_key

logger = get_logger(__name__)


class ImageStorageError(RuntimeError):
    """A storage operation failed in a way the caller must handle."""


class LocalImageStorage(ImageStorage):
    """Store image bytes on the local filesystem."""

    def __init__(self, root: Path, public_base_url: str) -> None:
        self._root = root
        self._public_base_url = public_base_url.rstrip("/")

    @property
    def root(self) -> Path:
        """The directory holding stored images. Created on first write."""
        return self._root

    def _resolve(self, key: str) -> Path:
        """Return the absolute path for `key`, or raise.

        Raises `ImageStorageError` - not `ValueError` - because a bad key means
        the caller's stored metadata is corrupt, which is an operational fault
        rather than a programming error.
        """
        if not is_valid_image_key(key):
            raise ImageStorageError("Refusing to resolve a malformed storage key.")

        candidate = (self._root / key).resolve()
        root = self._root.resolve()
        if not candidate.is_relative_to(root):
            raise ImageStorageError("Refusing to resolve a storage key outside the storage root.")
        return candidate

    async def save(self, key: str, data: bytes) -> str:
        path = self._resolve(key)
        try:
            # Blocking filesystem calls run in a worker thread: a photo upload
            # is disk I/O, and running it on the event loop would stall every
            # other in-flight request for the duration of the write.
            await asyncio.to_thread(self._write, path, data)
        except OSError as exc:
            raise ImageStorageError("Could not write the image to storage.") from exc
        return self.public_url(key)

    @staticmethod
    def _write(path: Path, data: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        # Write-then-rename so a reader never observes a half-written file, and
        # so a crash mid-write leaves no partial object that looks valid.
        temporary = path.with_name(f".{path.name}.partial")
        temporary.write_bytes(data)
        temporary.replace(path)

    async def delete(self, key: str) -> bool:
        path = self._resolve(key)
        try:
            return await asyncio.to_thread(self._remove, path)
        except OSError as exc:
            raise ImageStorageError("Could not remove the image from storage.") from exc

    @staticmethod
    def _remove(path: Path) -> bool:
        try:
            path.unlink()
        except FileNotFoundError:
            return False
        return True

    async def exists(self, key: str) -> bool:
        path = self._resolve(key)
        return await asyncio.to_thread(path.is_file)

    def public_url(self, key: str) -> str:
        if not is_valid_image_key(key):
            raise ImageStorageError("Refusing to build a URL for a malformed storage key.")
        return f"{self._public_base_url}/{key}"

    def open(self, key: str) -> bytes:
        path = self._resolve(key)
        try:
            return path.read_bytes()
        except FileNotFoundError as exc:
            raise ImageStorageError("The stored image is missing.") from exc
        except OSError as exc:
            raise ImageStorageError("Could not read the image from storage.") from exc
