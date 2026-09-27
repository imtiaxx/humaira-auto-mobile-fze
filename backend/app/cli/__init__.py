"""Operator command line for Humera Automobile.

Run with `python -m app.cli`. The implementation is in `commands.py`; this module
exists so callers can `from app.cli import main` without importing the package's
`__main__` module, which is not a normal import target.
"""

from app.cli.commands import main

__all__ = ["main"]
