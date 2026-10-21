from decimal import Decimal

from psycopg import Connection


def fetch_wallet(
    connection: Connection,
    user_id: int,
) -> dict | None:
    """Return a user's wallet without exposing another user's wallet."""
    row = connection.execute(
        """
        SELECT wallet_id, balance, currency, created_at, updated_at
        FROM wallets
        WHERE user_id = %s
        """,
        (user_id,),
    ).fetchone()

    if row is None:
        return None

    return {
        "wallet_id": row["wallet_id"],
        "balance": Decimal(row["balance"]),
        "currency": row["currency"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }
