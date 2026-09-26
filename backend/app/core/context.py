"""Request-scoped context stored in :mod:`contextvars`.

``ContextVar`` is used instead of thread locals because the application is
async: context variables propagate correctly across ``await`` boundaries
inside a single request task.
"""

from __future__ import annotations

from contextvars import ContextVar, Token
from uuid import uuid4

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def get_request_id() -> str:
    """Return the current request ID, generating one if none was set."""
    current = _request_id.get()
    if current is None:
        current = uuid4().hex[:12]
        _request_id.set(current)
    return current


def set_request_id(value: str) -> Token[str | None]:
    """Bind a request ID to the current context."""
    return _request_id.set(value)


def reset_request_id(token: Token[str | None]) -> None:
    """Restore the previous request ID."""
    _request_id.reset(token)
