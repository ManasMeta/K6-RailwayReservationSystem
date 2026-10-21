"""Database connection pool management with psycopg 3."""

from contextlib import contextmanager
from typing import Generator

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from app.core.config import settings

_pool: ConnectionPool | None = None


def init_db_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=settings.DATABASE_URL,
            min_size=2,
            max_size=25,
            kwargs={"row_factory": dict_row, "autocommit": False},
            open=False,
        )
        try:
            _pool.open()
        except Exception:
            # If database is not currently running (e.g. during build/linting), pool can remain closed
            pass
    return _pool


def close_db_pool():
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def get_db_connection(user_id: int | None = None) -> Generator[psycopg.Connection, None, None]:
    """Provides a connection from the pool and sets RLS session setting app.user_id if provided."""
    global _pool
    if _pool is None:
        init_db_pool()

    conn = _pool.getconn()
    try:
        if user_id is not None:
            with conn.cursor() as cur:
                cur.execute("SET LOCAL app.user_id = %s;", (str(user_id),))
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        _pool.putconn(conn)
