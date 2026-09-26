"""Data-access layer.

Repositories encapsulate all SQLAlchemy queries for a given aggregate. Route
handlers and services depend on these rather than on the ORM directly, which
keeps query logic testable in isolation and makes it straightforward to change
the storage strategy later.
"""
