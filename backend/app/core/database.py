from collections.abc import Generator
from contextlib import contextmanager

import psycopg
from fastapi import Request
from psycopg.rows import dict_row

from app.core.auth import optional_user
from app.core.config import get_settings


def _set_identity(connection: psycopg.Connection, user_id: int | None, role: str | None, local: bool) -> None:
    """Tell PostgreSQL who is calling, for row-level security and fn_audit().

    set_config(..., true) is SET LOCAL (this transaction only) and, unlike SET, takes bound
    parameters. local=False keeps the setting for the whole connection, which is right for a
    connection that serves exactly one request.
    """
    if user_id is not None:
        connection.execute("SELECT set_config('app.user_id', %s, %s)", (str(user_id), local))
    if role is not None:
        connection.execute("SELECT set_config('app.user_role', %s, %s)", (role, local))


def get_db_connection(request: Request = None) -> Generator[psycopg.Connection, None, None]:
    """Yield a PostgreSQL connection for one request and always close it.

    When the request carries a valid bearer token the caller's id and role are set on the
    connection, so row-level security applies to everything the route does.
    """
    connection = psycopg.connect(
        get_settings().database_url,
        row_factory=dict_row,
        connect_timeout=5,
    )
    try:
        caller = optional_user(request)
        if caller is not None:
            _set_identity(connection, caller.user_id, caller.role, local=False)
            connection.commit()  # settings survive commit because they are session-level
        yield connection
    finally:
        connection.close()


@contextmanager
def system_connection() -> Generator[psycopg.Connection, None, None]:
    """A connection for background jobs: identified as role "system" for its whole life."""
    connection = psycopg.connect(
        get_settings().database_url,
        row_factory=dict_row,
        connect_timeout=5,
    )
    try:
        _set_identity(connection, None, "system", local=False)
        connection.commit()
        yield connection
    finally:
        connection.close()


@contextmanager
def db_session(user_id: int | None = None, role: str | None = None) -> Generator[psycopg.Connection, None, None]:
    """Yield a connection in one transaction; commit on success, roll back on error.

    user_id / role identify the caller for this transaction only. Background jobs pass
    role="system".
    """
    connection = psycopg.connect(
        get_settings().database_url,
        row_factory=dict_row,
        connect_timeout=5,
    )
    try:
        _set_identity(connection, user_id, role, local=True)
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
