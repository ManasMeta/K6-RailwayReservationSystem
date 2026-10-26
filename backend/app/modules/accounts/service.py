from functools import lru_cache

import bcrypt
from psycopg import Connection
from psycopg.errors import UniqueViolation

from app.core.auth import create_access_token
from app.modules.accounts import sql
from app.modules.accounts.errors import AccountsError
from app.modules.accounts.schemas import (
    MAX_SAVED_PASSENGERS,
    LoginRequest,
    ProfileUpdate,
    SavedPassengerIn,
    SignupRequest,
)


@lru_cache
def _dummy_hash() -> bytes:
    """Hash checked when the email is unknown so both login paths cost the same."""
    return bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt())


def _public_user(row: dict) -> dict:
    return {k: row[k] for k in ("user_id", "email", "full_name", "phone", "role")}


def _token_response(row: dict) -> dict:
    return {
        "access_token": create_access_token(row["user_id"], row["email"], row["role"]),
        "token_type": "bearer",
        "user": _public_user(row),
    }


def signup(connection: Connection, data: SignupRequest) -> dict:
    password_hash = bcrypt.hashpw(data.password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")
    try:
        connection.execute(sql.REGISTER, (data.email, password_hash, data.full_name, data.phone))
        row = connection.execute(sql.GET_USER_BY_EMAIL, (data.email,)).fetchone()
        connection.commit()
    except UniqueViolation as exc:
        connection.rollback()
        raise AccountsError(409, "An account with this email already exists", "EMAIL_TAKEN") from exc
    return _token_response(row)


def login(connection: Connection, data: LoginRequest) -> dict:
    row = connection.execute(sql.GET_USER_BY_EMAIL, (data.email,)).fetchone()
    stored = row["password_hash"].encode("ascii") if row else _dummy_hash()
    matches = bcrypt.checkpw(data.password.encode("utf-8"), stored)
    if not row or not matches:
        raise AccountsError(401, "Incorrect email or password", "AUTH_INVALID")
    return _token_response(row)


def get_user(connection: Connection, user_id: int) -> dict:
    row = connection.execute(sql.GET_USER_BY_ID, (user_id,)).fetchone()
    if not row:
        raise AccountsError(401, "Account no longer exists", "AUTH_INVALID")
    return _public_user(row)


def update_profile(connection: Connection, user_id: int, data: ProfileUpdate) -> dict:
    connection.execute(sql.UPDATE_PROFILE, (data.full_name, data.phone, user_id))
    connection.commit()
    return get_user(connection, user_id)


def refresh(connection: Connection, user_id: int) -> dict:
    """Re-read the user so a role change takes effect on the new token."""
    row = connection.execute(sql.GET_USER_BY_ID, (user_id,)).fetchone()
    if not row:
        raise AccountsError(401, "Account no longer exists", "AUTH_INVALID")
    return _token_response(row)


def list_passengers(connection: Connection, user_id: int) -> list[dict]:
    return connection.execute(sql.LIST_PASSENGERS, (user_id,)).fetchall()


def add_passenger(connection: Connection, user_id: int, data: SavedPassengerIn) -> dict:
    # Locking the user row serialises concurrent adds so the cap cannot be exceeded.
    connection.execute(sql.LOCK_USER, (user_id,))
    count = connection.execute(sql.COUNT_PASSENGERS, (user_id,)).fetchone()["n"]
    if count >= MAX_SAVED_PASSENGERS:
        connection.rollback()
        raise AccountsError(
            409, f"You can save at most {MAX_SAVED_PASSENGERS} passengers", "PASSENGER_LIMIT"
        )
    row = connection.execute(
        sql.INSERT_PASSENGER,
        (user_id, data.full_name, data.age, data.gender, data.berth_preference, data.senior_citizen),
    ).fetchone()
    connection.commit()
    return row


def delete_passenger(connection: Connection, user_id: int, passenger_id: int) -> None:
    deleted = connection.execute(sql.DELETE_PASSENGER, (passenger_id, user_id)).fetchone()
    connection.commit()
    if not deleted:
        raise AccountsError(404, "Saved passenger not found", "PASSENGER_NOT_FOUND")
