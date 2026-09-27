"""Timestamp helpers.

One rule, stated once: a datetime crossing the database boundary is always made
timezone-aware UTC before it is compared with the clock or handed to a client.

The reason is that the two supported databases disagree. PostgreSQL's
`TIMESTAMPTZ` round-trips with an offset; SQLite has no timezone type at all and
returns a naive value, silently dropping the offset on the way in. Both are
correct databases, so the application cannot rely on either behaviour - and code
that does produces failures that appear only under test:

* `aware - naive` raises `TypeError`, turning a session-expiry check into a 500.
* A timestamp serialises as `2026-01-01T00:00:00Z` on one path and
  `2026-01-01T00:00:00` on another, so a client has to accept two shapes for one
  field and cannot tell whether the missing offset means UTC or means local time.

Attaching UTC to a naive value is a *restoration*, not a guess. Every timestamp
this application writes is UTC - see `app/services/auth.py` and the
`TimestampMixin` - so a naive value read back is a UTC value that lost its
suffix on the way through the driver.

Kept in one module so the fix cannot be applied in one place and forgotten in
another, which is how a driver-specific bug becomes intermittent.
"""

from __future__ import annotations

from datetime import UTC, datetime


def as_utc(value: datetime) -> datetime:
    """Return `value` as a timezone-aware UTC datetime.

    A naive value is assumed to be UTC, which is what this application stores.
    An aware value is converted, so a value that arrived in another offset is
    still comparable with the clock.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
