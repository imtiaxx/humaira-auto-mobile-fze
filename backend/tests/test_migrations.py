"""Migration tests - the real Alembic chain, applied for real.

Most of this suite builds its schema from ``Base.metadata.create_all``, which is
the right thing for testing application code: it is fast, and it cannot fail for
reasons unrelated to the code under test. But it means the migrations themselves
are never executed, and a migration is a piece of code that can be wrong in ways
the models cannot be.

That is not hypothetical. The Step 17 migration originally declared
``ix_enquiries_vehicle_id`` twice in the same ``upgrade()``, and no amount of
testing the models would ever have noticed, because ``create_all`` reads the model
metadata, which was correct. The bug only existed in the file that a fresh
deployment actually runs.

So these tests apply the chain the way a deployment does - from ``base`` to
``head``, through every revision - and then look at the schema that came out.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
import sqlalchemy as sa
from alembic.config import Config
from alembic.script import ScriptDirectory

from alembic import command

BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _config(database: Path) -> Config:
    """An Alembic config pointed at a throwaway database.

    The URL is overridden rather than read from the environment so this never
    touches the developer's real database. Getting that wrong would mean the test
    suite dropping the tables of whatever the developer is working on, so the
    override is not optional and the temp file is not a convenience.
    """
    config = Config(str(BACKEND_ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_ROOT / "alembic"))
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database.as_posix()}")
    return config


def _upgrade(database: Path, revision: str) -> None:
    command.upgrade(_config(database), revision)


def _downgrade(database: Path, revision: str) -> None:
    command.downgrade(_config(database), revision)


@pytest.fixture
def migrated(tmp_path: Path) -> Any:
    """A database with the full chain applied, plus an inspector to read it.

    Yields the `Inspector` rather than the engine so callers cannot accidentally
    keep a connection open. On Windows an open SQLite handle blocks deletion of the
    file, and `tmp_path` cleanup would then fail with a `PermissionError` that has
    nothing to do with the test.
    """
    database = tmp_path / "chain.db"
    _upgrade(database, "head")

    engine = sa.create_engine(f"sqlite:///{database.as_posix()}")
    try:
        yield sa.inspect(engine), database
    finally:
        engine.dispose()


# ---------------------------------------------------------------------------
# The chain itself
# ---------------------------------------------------------------------------


class TestChainShape:
    """The history, before any of its content.

    A branched or multi-headed history does not fail on the developer's machine -
    the database is already at one head - and fails only on a fresh deployment,
    which is the worst possible time to discover it.
    """

    def test_has_exactly_one_head(self) -> None:
        """One head, so ``alembic upgrade head`` is unambiguous."""
        script = ScriptDirectory(str(BACKEND_ROOT / "alembic"))
        heads = script.get_heads()

        assert len(heads) == 1, f"expected one head, found {heads}"

    def test_history_is_linear(self) -> None:
        """No branches, and therefore no merge revisions to resolve.

        Walked from the single head back to base. `down_revision` is a plain string
        for a single parent and a tuple for a merge, so a revision that joins two
        branches is the one whose `down_revision` is not a string.
        """
        script = ScriptDirectory(str(BACKEND_ROOT / "alembic"))

        merges = [
            rev.revision
            for rev in script.walk_revisions()
            if not isinstance(rev.down_revision, str | None)
        ]
        assert merges == [], f"merge revisions present: {merges}"

    def test_every_revision_is_reachable_from_base(self) -> None:
        """`walk_revisions` returns the whole history, and the count matches the files.

        The file count is compared because a revision that exists on disk but is
        not in the chain is invisible to `upgrade` and applies nowhere - the
        definition of a migration that silently does nothing.
        """
        script = ScriptDirectory(str(BACKEND_ROOT / "alembic"))
        in_chain = {rev.revision for rev in script.walk_revisions()}
        on_disk = {
            path.stem.split("_", 1)[0]
            for path in (BACKEND_ROOT / "alembic" / "versions").glob("*.py")
        }

        assert on_disk - in_chain == set(), "revision files not reachable from base"

    def test_step_17_is_the_head(self) -> None:
        """The enquiries migration is the newest thing to be applied.

        Worth pinning because the deployment order is the whole reason the table
        exists: nothing else in the chain creates it.
        """
        script = ScriptDirectory(str(BACKEND_ROOT / "alembic"))

        assert script.get_current_head() == "d5ab53f633ea"


# ---------------------------------------------------------------------------
# Applying it
# ---------------------------------------------------------------------------


class TestUpgrade:
    def test_applies_from_base_to_head(self, migrated: tuple[Any, Path]) -> None:
        """A fresh database reaches head with every table present.

        This is the test the duplicate-index bug would have failed: the second
        `create_index` for the same name on the same table is an error at the
        point it runs, and nothing else in the suite executes that file.
        """
        inspector, _ = migrated

        assert set(inspector.get_table_names()) >= {
            "vehicles",
            "vehicle_images",
            "users",
            "staff_sessions",
            "enquiries",
        }

    def test_enquiries_table_has_the_expected_columns(self, migrated: tuple[Any, Path]) -> None:
        """Every column the model needs exists, and none of them is nullable by accident.

        `vehicle_slug` is the one that looks optional and is not: it is a
        `NOT NULL` denormalised copy of the vehicle's slug, and letting it be null
        would put a hole in the staff list, which renders it as the link back to
        the vehicle.
        """
        inspector, _ = migrated
        columns = {column["name"]: column for column in inspector.get_columns("enquiries")}

        assert set(columns) == {
            "id",
            "vehicle_id",
            "vehicle_slug",
            "customer_name",
            "customer_email",
            "customer_phone",
            "message",
            "status",
            "created_at",
            "updated_at",
        }
        for name, column in columns.items():
            assert column["nullable"] is False, f"{name} should be NOT NULL"

    def test_creates_the_vehicle_index_exactly_once(self, migrated: tuple[Any, Path]) -> None:
        """One index, on `vehicle_id`, and not unique.

        The regression test for the repaired migration, stated as an invariant
        rather than as "it runs". A duplicate `create_index` is caught by
        `test_applies_from_base_to_head`, but only incidentally - SQLite happens
        to reject the repeated name. This one reads the result, so it also catches
        an index that was renamed rather than removed, or quietly given the wrong
        columns.
        """
        inspector, _ = migrated
        indexes = inspector.get_indexes("enquiries")

        assert [index["name"] for index in indexes] == ["ix_enquiries_vehicle_id"]
        assert indexes[0]["column_names"] == ["vehicle_id"]
        assert not indexes[0]["unique"]

    def test_enforces_one_enquiry_per_customer_per_vehicle(
        self, migrated: tuple[Any, Path]
    ) -> None:
        """The unique constraint is on the pair, in that order.

        This is the constraint the whole duplicate-handling path exists to serve:
        it is what turns a second submission from the same address into a
        `ConflictError` rather than a second row a dealership has to notice and
        delete by hand. A unique constraint on `vehicle_id` alone would look right
        in a column list and make the second interested customer impossible.
        """
        inspector, _ = migrated
        constraints = inspector.get_unique_constraints("enquiries")

        assert len(constraints) == 1
        assert constraints[0]["column_names"] == ["vehicle_id", "customer_email"]

    def test_deletes_enquiries_with_their_vehicle(self, migrated: tuple[Any, Path]) -> None:
        """The foreign key cascades.

        An enquiry has no meaning once the vehicle row is gone, and the vehicles
        table supports hard deletion. Without `ON DELETE CASCADE` a delete would
        fail on the foreign key, and the staff UI's delete button would be
        permanently broken for exactly the cars that have had no interest.
        """
        inspector, _ = migrated
        foreign_keys = inspector.get_foreign_keys("enquiries")

        assert len(foreign_keys) == 1
        assert foreign_keys[0]["referred_table"] == "vehicles"
        assert foreign_keys[0]["referred_columns"] == ["id"]
        assert foreign_keys[0]["options"].get("ondelete") == "CASCADE"

    def test_constrains_status_to_the_known_values(self, migrated: tuple[Any, Path]) -> None:
        """A `CHECK` on status exists.

        The application's `Literal` is the rule this is the backstop for. A
        database-level check is what stops a value outside the enum reaching the
        table by any route the application does not own - a migration, a script,
        a future endpoint that forgets the enum. Without it, such a value would be
        invisible in every staff status filter, which reads as data loss.
        """
        inspector, _ = migrated
        checks = inspector.get_check_constraints("enquiries")

        rendered = " ".join(check["sqltext"] for check in checks)
        for status in ("pending", "answered", "closed"):
            assert status in rendered, f"{status} missing from the check constraint: {rendered}"

    def test_defaults_the_status_to_pending(self, migrated: tuple[Any, Path]) -> None:
        """`status` defaults to `pending`.

        Defence in depth. The public schema does not accept a status, so the
        application always sets one, and the test suite asserts the value is
        `pending`. The column default matters only for a row written by something
        else - and for what that row would look like in the backlog: a new enquiry
        with a blank status would appear in no filter at all.
        """
        inspector, _ = migrated
        columns = {column["name"]: column for column in inspector.get_columns("enquiries")}

        assert "pending" in str(columns["status"].get("default", ""))

    def test_stamps_both_timestamps(self, migrated: tuple[Any, Path]) -> None:
        """`created_at` and `updated_at` are both server-defaulted.

        The alternative is nullable columns that sort unpredictably, and the staff
        list orders on `created_at` - so a null there would send the row to an
        arbitrary place in the backlog.
        """
        inspector, _ = migrated
        columns = {column["name"]: column for column in inspector.get_columns("enquiries")}

        assert columns["created_at"].get("default") is not None
        assert columns["updated_at"].get("default") is not None

    def test_stores_the_message_unbounded(self, migrated: tuple[Any, Path]) -> None:
        """`message` is TEXT, not VARCHAR.

        A `VARCHAR` here would be a schema that disagrees with the schema's own
        `max_length=2000` - harmless today, but the moment the two drift the
        database would truncate a customer's question without telling anyone, and
        the length bound would still be enforced in Python against the value that
        was stored rather than the one that was sent.
        """
        inspector, _ = migrated
        columns = {column["name"]: column for column in inspector.get_columns("enquiries")}

        assert "TEXT" in str(columns["message"]["type"]).upper()

    def test_is_idempotent_at_head(self, migrated: tuple[Any, Path]) -> None:
        """Upgrading a database already at head is a no-op, not an error.

        Deployments run migrations on every start. A migration that fails when it
        is already applied turns a healthy restart into an outage.
        """
        _, database = migrated
        inspector_before = sa.inspect(sa.create_engine(f"sqlite:///{database.as_posix()}"))
        before = sorted(inspector_before.get_table_names())

        _upgrade(database, "head")

        engine = sa.create_engine(f"sqlite:///{database.as_posix()}")
        try:
            assert sorted(sa.inspect(engine).get_table_names()) == before
        finally:
            engine.dispose()


# ---------------------------------------------------------------------------
# Model/migration agreement
# ---------------------------------------------------------------------------


class TestModelsMatchMigrations:
    """The models and the migrations must describe the same database.

    ``create_all`` reads the models and the migrations read the revision files, so
    the rest of the suite can be entirely green while the two disagree - and the
    disagreement only surfaces as an `UndefinedColumn` on a database that was
    migrated rather than created in-process. That is the production database.
    """

    def test_every_migrated_table_exists_in_the_models(self, migrated: tuple[Any, Path]) -> None:
        """No table in the database that the application does not know about.

        A leftover table from a dropped model is harmless, but a *missing* table
        or a renamed one is not, and this is the cheapest place to notice.
        """
        from app.db.models import Base

        inspector, _ = migrated
        migrated_tables = set(inspector.get_table_names()) - {"alembic_version"}
        model_tables = set(Base.metadata.tables)

        assert migrated_tables <= model_tables, f"unknown tables: {migrated_tables - model_tables}"

    def test_every_model_table_was_created_by_a_migration(self, migrated: tuple[Any, Path]) -> None:
        """No table in the models that no migration creates.

        The mirror image of the test above, and the more dangerous direction: a
        model for a table that only ``create_all`` would ever make is a table that
        does not exist on any real deployment. Every test in the suite would pass,
        because every test in the suite calls ``create_all``.

        Read from the migrated database rather than from the revision files, so
        the claim is about what the migrations actually produce instead of about
        what they were written to produce.
        """
        from app.db.models import Base

        inspector, _ = migrated
        migrated_tables = set(inspector.get_table_names()) - {"alembic_version"}
        model_tables = set(Base.metadata.tables)

        assert model_tables - migrated_tables == set(), (
            f"models without a migration: {model_tables - migrated_tables}"
        )

    def test_columns_agree_for_every_table(self, migrated: tuple[Any, Path]) -> None:
        """Table by table, the migrated columns are the model's columns.

        Compared as sets rather than in order, because column order is not part of
        the contract. A column in one and not the other is the failure that
        matters: the model asks for a column the database does not have, or the
        database has one nobody reads.
        """
        from app.db.models import Base

        inspector, _ = migrated

        for table_name, table in Base.metadata.tables.items():
            if table_name not in inspector.get_table_names():
                continue
            migrated_columns = {column["name"] for column in inspector.get_columns(table_name)}
            model_columns = {column.name for column in table.columns}

            assert migrated_columns == model_columns, (
                f"{table_name}: "
                f"only in migration {migrated_columns - model_columns}, "
                f"only in model {model_columns - migrated_columns}"
            )


# ---------------------------------------------------------------------------
# Downgrade
# ---------------------------------------------------------------------------


class TestDowngrade:
    def test_step_17_downgrades_and_upgrades_again(self, tmp_path: Path) -> None:
        """The enquiry migration is reversible, and reversible in that order.

        Reverting to the previous revision and forward again exercises both halves
        of the pair against a database that already holds the data. A migration
        whose `downgrade` forgets to drop something its `upgrade` created fails
        here, not at the next deploy.
        """
        database = tmp_path / "roundtrip.db"

        _upgrade(database, "head")
        _downgrade(database, "44e9718a5560")

        engine = sa.create_engine(f"sqlite:///{database.as_posix()}")
        try:
            assert "enquiries" not in sa.inspect(engine).get_table_names()
        finally:
            engine.dispose()

        _upgrade(database, "head")

        engine = sa.create_engine(f"sqlite:///{database.as_posix()}")
        try:
            inspector = sa.inspect(engine)
            assert "enquiries" in inspector.get_table_names()
            # The index has to come back too. Recreating the table without it would
            # pass a check that only looks for tables, and leave every staff list
            # query doing a sequential scan.
            assert [index["name"] for index in inspector.get_indexes("enquiries")] == [
                "ix_enquiries_vehicle_id"
            ]
        finally:
            engine.dispose()

    def test_downgrades_all_the_way_to_base(self, tmp_path: Path) -> None:
        """The full chain unwinds, leaving only Alembic's own bookkeeping.

        A `downgrade` that cannot reach base is not a downgrade; it is a one-way
        door that looks like a two-way one. This is also the test that catches an
        `op.drop_index` in a migration whose `downgrade` runs before its table
        exists, which is otherwise a failure only in a developer's `downgrade -1`
        loop.
        """
        database = tmp_path / "unwind.db"

        _upgrade(database, "head")
        _downgrade(database, "base")

        engine = sa.create_engine(f"sqlite:///{database.as_posix()}")
        try:
            remaining = set(sa.inspect(engine).get_table_names())
        finally:
            engine.dispose()

        assert remaining <= {"alembic_version"}, (
            f"tables left behind: {remaining - {'alembic_version'}}"
        )
