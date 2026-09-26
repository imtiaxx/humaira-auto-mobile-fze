"""Structured logging architecture.

A single JSON-compatible formatter plus per-request correlation IDs. Uvicorn's
own loggers are re-parented to ours so that access logs and application logs
share one format and can be shipped to a log aggregator unchanged.
"""

from __future__ import annotations

import json
import logging
import sys
from typing import Any, Final

from app.core.config import LogFormat, settings

#: Attributes present on every ``LogRecord``; anything else is user context.
_RESERVED_RECORD_FIELDS: Final[frozenset[str]] = frozenset(
    {
        "args",
        "asctime",
        "created",
        "exc_info",
        "exc_text",
        "filename",
        "funcName",
        "levelname",
        "levelno",
        "lineno",
        "module",
        "msecs",
        "message",
        "msg",
        "name",
        "pathname",
        "process",
        "processName",
        "relativeCreated",
        "stack_info",
        "taskName",
        "thread",
        "threadName",
    }
)

#: Logger names configured by third-party libraries that must stay quiet.
_NOISY_LOGGERS: Final[tuple[str, ...]] = (
    "sqlalchemy.engine.Engine",
    "passlib",
    "httpcore",
    "httpx",
    "asyncio",
)


class RequestIdFilter(logging.Filter):
    """Attach the current request ID to every record it sees."""

    def filter(self, record: logging.LogRecord) -> bool:
        from app.core.context import get_request_id

        record.request_id = get_request_id()  # type: ignore[attr-defined]
        return True


class JsonFormatter(logging.Formatter):
    """Render records as one JSON object per line for log aggregators."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", None),
        }
        for key, value in record.__dict__.items():
            if key not in _RESERVED_RECORD_FIELDS and key != "request_id":
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str, ensure_ascii=False)


class ConsoleFormatter(logging.Formatter):
    """Human-readable single-line output for local development."""

    default_fmt = "%(asctime)s %(levelname)-8s [%(request_id)s] %(name)s: %(message)s"
    verbose_fmt = (
        "%(asctime)s %(levelname)-8s [%(request_id)s] "
        "%(name)s %(filename)s:%(lineno)d - %(message)s"
    )

    def __init__(self, *, verbose: bool = False) -> None:
        super().__init__(
            fmt=self.verbose_fmt if verbose else self.default_fmt,
            datefmt="%H:%M:%S",
        )

    def format(self, record: logging.LogRecord) -> str:
        # Guarantees the filter's attribute exists even for third-party loggers
        # whose records bypass our handler chain ordering.
        if not hasattr(record, "request_id"):
            record.request_id = "-"  # type: ignore[attr-defined]
        return super().format(record)


def _build_formatter(log_format: LogFormat) -> logging.Formatter:
    if log_format == "json":
        return JsonFormatter()
    return ConsoleFormatter(verbose=settings.debug)


def configure_logging() -> None:
    """Install the root log handler. Idempotent; safe to call repeatedly."""
    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(_build_formatter(settings.log_format))
    handler.addFilter(RequestIdFilter())

    root = logging.getLogger()
    for existing in list(root.handlers):
        root.removeHandler(existing)
    root.addHandler(handler)
    root.setLevel(settings.log_level)

    # Route uvicorn access/error logs through the same formatter.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers = []
        uvicorn_logger.propagate = True

    for name in _NOISY_LOGGERS:
        logging.getLogger(name).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Return a named application logger."""
    return logging.getLogger(name)
