"""Security primitive tests.

These verify the primitives only. No authentication endpoint exists in Step 1.
"""

from __future__ import annotations

import pytest

from app.core.errors import AuthenticationError, ValidationError
from app.core.security import (
    decode_token,
    generate_session_id,
    hash_password,
    hash_token,
    password_needs_rehash,
    verify_password,
)

VALID_PASSWORD = "Correct-Horse-9-Battery"


def test_password_is_never_stored_in_plaintext() -> None:
    password_hash = hash_password(VALID_PASSWORD)

    assert VALID_PASSWORD not in password_hash
    assert password_hash.startswith("$argon2")


def test_password_round_trip_verifies() -> None:
    password_hash = hash_password(VALID_PASSWORD)

    assert verify_password(VALID_PASSWORD, password_hash) is True
    assert verify_password("wrong-password-entirely", password_hash) is False


def test_password_hashes_are_salted_and_unique() -> None:
    first = hash_password(VALID_PASSWORD)
    second = hash_password(VALID_PASSWORD)

    assert first != second


def test_weak_passwords_are_rejected() -> None:
    with pytest.raises(ValidationError):
        hash_password("short1A!")

    with pytest.raises(ValidationError):
        hash_password("alllowercaseonly")


def test_current_hash_does_not_need_rehash() -> None:
    password_hash = hash_password(VALID_PASSWORD)

    assert password_needs_rehash(VALID_PASSWORD, password_hash) is None


def test_hash_made_with_weaker_parameters_is_upgraded() -> None:
    from pwdlib import PasswordHash
    from pwdlib.hashers.argon2 import Argon2Hasher

    weak_hash = PasswordHash((Argon2Hasher(time_cost=1, memory_cost=8192, parallelism=1),)).hash(
        VALID_PASSWORD
    )

    upgraded = password_needs_rehash(VALID_PASSWORD, weak_hash)

    assert upgraded is not None
    assert verify_password(VALID_PASSWORD, upgraded) is True


def test_wrong_password_never_triggers_a_rehash() -> None:
    password_hash = hash_password(VALID_PASSWORD)

    assert password_needs_rehash("not-the-password", password_hash) is None


def test_malformed_hash_does_not_raise() -> None:
    assert verify_password(VALID_PASSWORD, "not-a-real-hash") is False


def test_session_ids_are_unique_and_long() -> None:
    first = generate_session_id()
    second = generate_session_id()

    assert first != second
    assert len(first) >= 43


def test_token_digest_is_stable_and_not_reversible() -> None:
    token = generate_session_id()

    assert hash_token(token) == hash_token(token)
    assert token not in hash_token(token)
    assert len(hash_token(token)) == 64


def test_decode_token_rejects_garbage() -> None:
    with pytest.raises(AuthenticationError):
        decode_token("not.a.jwt")
