from collections.abc import Generator
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from app.core.config import get_settings


def get_db_connection() -> Generator[psycopg.Connection, None, None]:
    """Yield a PostgreSQL connection and always close it."""
    connection = psycopg.connect(
        get_settings().database_url,
        row_factory=dict_row,
        connect_timeout=5,
    )
    try:
        yield connection
    finally:
        connection.close()


@contextmanager
def db_session(user_id: int | None = None) -> Generator[psycopg.Connection, None, None]:
    """Yield a connection in one transaction; commit on success, roll back on error.

    When user_id is given it is set as app.user_id for the transaction only, which is
    what the row-level-security policies and fn_audit() read.
    """
    connection = psycopg.connect(
        get_settings().database_url,
        row_factory=dict_row,
        connect_timeout=5,
    )
    try:
        if user_id is not None:
            # set_config(..., true) is SET LOCAL and, unlike SET, accepts a bound parameter.
            connection.execute("SELECT set_config('app.user_id', %s, true)", (str(user_id),))
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()
