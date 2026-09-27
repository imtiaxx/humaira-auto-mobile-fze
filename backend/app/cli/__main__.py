"""Executable entry point: `python -m app.cli`.

Kept to two lines so that the command implementations stay in `commands.py` and
are importable for tests without executing anything.
"""

from app.cli.commands import main

if __name__ == "__main__":
    raise SystemExit(main())
