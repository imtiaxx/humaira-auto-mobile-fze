"""Staff session repository.

Session lookups happen on every authenticated request, so the hot path is one
indexed equality on `token_hash` followed by a joined `users` row. Both the
expiry check and the account check are in this module rather than the service,
because "which sessions are still good" is a question about rows, not policy.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import joinedload

from app.db.models.staff_session import StaffSession
from app.repositories.base import BaseRepository


class StaffSessionRepository(BaseRepository[StaffSession]):
    """Reads and writes for `staff_sessions`."""

    model = StaffSession

    async def get_live_by_token_hash(
        self,
        token_hash: str,
        *,
        now: datetime,
    ) -> StaffSession | None:
        """Return the session for a token digest, if it can still authenticate.

        Loads the owning user in the same round trip. Without `joinedload` the
        caller would trigger a second query per request inside async SQLAlchemy,
        which raises rather than silently awaiting.
        """
        result = await self._session.scalars(
            select(StaffSession)
            .options(joinedload(StaffSession.user))
            .where(
                StaffSession.token_hash == token_hash,
                StaffSession.revoked_at.is_(None),
                StaffSession.expires_at > now,
            )
        )
        return result.first()

    async def list_for_user(self, user_id: object) -> Sequence[StaffSession]:
        """Every session belonging to one user, newest first."""
        result = await self._session.scalars(
            select(StaffSession)
            .where(StaffSession.user_id == user_id)
            .order_by(StaffSession.created_at.desc())
        )
        return result.all()

    async def purge_expired(self, *, now: datetime) -> int:
        """Delete every session that expired before `now`. Returns the count.

        Expiry is *also* enforced on read, so this is housekeeping rather than
        correctness: a row nobody can authenticate with is still a row holding a
        user id, a user agent and an IP address.
        """
        result = await self._session.execute(
            delete(StaffSession).where(StaffSession.expires_at <= now)
        )
        # `execute` is typed as returning `Result`, which has no `rowcount`;
        # a DELETE actually yields a `CursorResult`, which does.
        return int(getattr(result, "rowcount", 0) or 0)

    async def revoke_all_for_user(self, user_id: object, *, now: datetime) -> int:
        """Revoke every live session for a user. Used when an account is disabled.

        Returns the number revoked so the caller can report it, and so a test can
        assert that disabling an account really did cut access.
        """
        sessions = await self.list_for_user(user_id)
        revoked = 0
        for session in sessions:
            if session.is_live(now=now):
                session.revoked_at = now
                revoked += 1
        await self.flush()
        return revoked

    @staticmethod
    def expiry_from(lifetime: timedelta, *, now: datetime) -> datetime:
        """Absolute expiry for a session created at `now`."""
        return now + lifetime
