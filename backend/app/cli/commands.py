"""Operator command line: `python -m app.cli`.

Staff accounts are created here and nowhere else. There is no registration
endpoint, no default password, and no "first run" account, because each of those
puts a credential in the repository or in a log where anyone with access to one
gets admin over the business's inventory.

The password is read from a hidden prompt with confirmation, never from a
command-line argument, so it does not end up in the shell history, in a process
listing visible to other users, or in a CI log.

Commands
--------
`create_staff`          add a staff account
`list_staff`            list accounts with their state
`set_active`            disable or re-enable an account
`revoke_sessions`       end every session belonging to an account
`purge_expired_sessions`  delete expired and revoked session rows
"""

from __future__ import annotations

import argparse
import asyncio
import getpass
import sys
from collections.abc import Callable, Coroutine, Sequence

from app.core.errors import AppError
from app.core.logging import configure_logging
from app.db.database import session_scope
from app.services.auth import (
    create_staff_user,
    find_account_by_email,
    list_staff_accounts,
    purge_inactive_sessions,
    revoke_every_session,
    set_account_active,
)

#: A command handler: takes parsed arguments, returns a process exit code.
#: A `Coroutine` rather than a bare `Awaitable` because `asyncio.run` needs
#: something it can close.
Handler = Callable[[argparse.Namespace], Coroutine[object, object, int]]


async def _create_staff(args: argparse.Namespace) -> int:
    """Create one staff account, prompting for the password."""
    full_name = args.full_name
    if full_name is None:
        # Prompts run in a worker thread. They block on a human, and blocking the
        # event loop while one is on screen is the same rule the storage class
        # follows for its disk writes.
        full_name = (await asyncio.to_thread(input, "Full name: ")).strip()
    if not full_name:
        print("A full name is required.", file=sys.stderr)
        return 2

    # Two hidden prompts, and a mismatch is caught here rather than at first
    # login. A typo'd password discovered later is a support call and a reset.
    password = await asyncio.to_thread(getpass.getpass, "Password: ")
    if password != await asyncio.to_thread(getpass.getpass, "Confirm password: "):
        print("The passwords did not match.", file=sys.stderr)
        return 2

    async with session_scope() as session:
        try:
            user = await create_staff_user(
                session,
                email=args.email,
                full_name=full_name,
                password=password,
                is_active=not args.inactive,
            )
        except AppError as exc:
            # The service validates strength and uniqueness and raises rather
            # than returning a flag, so a weak or duplicate address is a message
            # on stderr and exit 1, not a traceback.
            print(f"Could not create the account: {exc}", file=sys.stderr)
            return 1
        await session.commit()

    state = "active" if user.is_active else "inactive"
    print(f"Created staff account {user.email} ({state}), id {user.id}.")
    if not user.is_active:
        print("It is disabled: it cannot sign in until re-enabled with `set_active`.")
    return 0


async def _list_staff(_args: argparse.Namespace) -> int:
    """List every account, active or not."""
    async with session_scope() as session:
        users = await list_staff_accounts(session)

    if not users:
        print("No staff accounts exist yet. Create one with `create_staff`.")
        return 0

    print(f"{'EMAIL':38} {'NAME':24} {'ACTIVE':7} {'STAFF':6} ID")
    for user in users:
        print(
            f"{user.email:38} {user.full_name[:24]:24} "
            f"{user.is_active!s:7} {user.is_staff!s:6} {user.id}"
        )
    return 0


async def _set_active(args: argparse.Namespace) -> int:
    """Disable or re-enable one account."""
    async with session_scope() as session:
        user = await find_account_by_email(session, args.email)
        if user is None:
            print(f"No account matches {args.email}.", file=sys.stderr)
            return 1

        # Deactivating also revokes every live session, so the lockout is
        # immediate rather than "when the current session happens to expire".
        revoked = await set_account_active(session, user=user, active=args.active)
        await session.commit()

    state = "active" if args.active else "disabled"
    print(f"{args.email} is now {state}.")
    if not args.active:
        print(f"Revoked {revoked} live session(s) for this account.")
    return 0


async def _revoke_sessions(args: argparse.Namespace) -> int:
    """End every live session for one account."""
    async with session_scope() as session:
        user = await find_account_by_email(session, args.email)
        if user is None:
            print(f"No account matches {args.email}.", file=sys.stderr)
            return 1

        revoked = await revoke_every_session(session, user_id=user.id)
        await session.commit()

    print(f"Revoked {revoked} session(s) for {args.email}.")
    return 0


async def _purge_expired_sessions(_args: argparse.Namespace) -> int:
    """Delete session rows that can no longer authenticate anyone."""
    async with session_scope() as session:
        deleted = await purge_inactive_sessions(session)
        await session.commit()

    print(f"Deleted {deleted} expired or revoked session row(s).")
    return 0


def build_parser() -> argparse.ArgumentParser:
    """The full command line, as data."""
    parser = argparse.ArgumentParser(
        prog="python -m app.cli",
        description="Operator commands for Humera Automobile. Not for end users.",
    )
    subcommands = parser.add_subparsers(dest="command", required=True)

    create = subcommands.add_parser("create_staff", help="add a staff account")
    create.add_argument("email", help="the account's email address")
    create.add_argument("--full-name", help="display name; prompted for if omitted")
    create.add_argument(
        "--inactive",
        action="store_true",
        help="create it disabled, so it must be enabled before it can sign in",
    )
    create.set_defaults(handler=_create_staff)

    listing = subcommands.add_parser("list_staff", help="list staff accounts")
    listing.set_defaults(handler=_list_staff)

    active = subcommands.add_parser("set_active", help="disable or re-enable an account")
    active.add_argument("email")
    active.add_argument(
        "--active",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="--no-active disables the account and revokes its sessions",
    )
    active.set_defaults(handler=_set_active)

    revoke = subcommands.add_parser("revoke_sessions", help="end every session for an account")
    revoke.add_argument("email")
    revoke.set_defaults(handler=_revoke_sessions)

    purge = subcommands.add_parser(
        "purge_expired_sessions", help="delete expired and revoked session rows"
    )
    purge.set_defaults(handler=_purge_expired_sessions)

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Entry point. Returns a process exit code."""
    configure_logging()
    args = build_parser().parse_args(argv)
    handler: Handler = args.handler
    try:
        return asyncio.run(handler(args))
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        return 130
    except AppError as exc:
        # Expected, explained failures print a message rather than a traceback:
        # this tool is run by hand, and a stack trace helps nobody fix a bad
        # email address.
        print(f"Failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
