from collections.abc import Generator

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
