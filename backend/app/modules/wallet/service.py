from decimal import Decimal

from psycopg import Connection

MAX_AMOUNT = Decimal("99999999.99")


class IdempotencyConflict(Exception):
    """An idempotency key was reused with different request details."""


def fetch_wallet(connection: Connection, user_id: int) -> dict | None:
    row = connection.execute(
        """
        SELECT wallet_id, balance, currency, created_at, updated_at
        FROM wallets WHERE user_id = %s
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


def get_or_create_wallet(connection: Connection, user_id: int) -> dict:
    connection.execute(
        """
        INSERT INTO wallets (user_id)
        VALUES (%s)
        ON CONFLICT (user_id) DO NOTHING
        """,
        (user_id,),
    )

    wallet = fetch_wallet(connection, user_id)
    if wallet is None:
        raise RuntimeError("Wallet could not be created or retrieved")

    return wallet


def create_mock_topup(
    connection: Connection,
    user_id: int,
    amount: Decimal,
    idempotency_key: str,
) -> dict:
    if not amount.is_finite() or amount <= 0 or amount > MAX_AMOUNT:
        raise ValueError("Amount must be between 0.01 and 99999999.99 INR")

    amount = amount.quantize(Decimal("0.01"))

    connection.execute(
        "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))",
        (idempotency_key,),
    )

    existing = connection.execute(
        """
        SELECT t.topup_id, t.wallet_id, t.amount, t.status,
               t.provider_reference, w.user_id, w.balance, w.currency
        FROM topups t
        JOIN wallets w ON w.wallet_id = t.wallet_id
        WHERE t.idempotency_key = %s
        """,
        (idempotency_key,),
    ).fetchone()

    if existing is not None:
        if (
            existing["user_id"] != user_id
            or Decimal(existing["amount"]) != amount
        ):
            raise IdempotencyConflict(
                "Idempotency key was already used with different request details"
            )

        return {
            "topup_id": existing["topup_id"],
            "wallet_id": existing["wallet_id"],
            "amount": Decimal(existing["amount"]),
            "status": existing["status"],
            "provider_reference": existing["provider_reference"],
            "balance": Decimal(existing["balance"]),
            "currency": existing["currency"],
            "simulated": True,
            "replayed": True,
        }

    connection.execute(
        """
        INSERT INTO wallets (user_id)
        VALUES (%s)
        ON CONFLICT (user_id) DO NOTHING
        """,
        (user_id,),
    )

    wallet = connection.execute(
        """
        SELECT wallet_id, balance, currency
        FROM wallets WHERE user_id = %s FOR UPDATE
        """,
        (user_id,),
    ).fetchone()

    if wallet is None:
        raise RuntimeError("User wallet could not be initialized")

    if wallet["currency"] != "INR":
        raise ValueError("Only INR wallets are supported")

    topup = connection.execute(
        """
        INSERT INTO topups (
            wallet_id, idempotency_key, amount, status, provider_reference
        )
        VALUES (%s, %s, %s, 'PENDING', %s)
        RETURNING topup_id
        """,
        (
            wallet["wallet_id"],
            idempotency_key,
            amount,
            f"MOCK-UPI-{idempotency_key[:24]}",
        ),
    ).fetchone()

    topup_id = topup["topup_id"]

    ledger = connection.execute(
        """
        INSERT INTO ledger_txns (
            txn_type, reference_type, reference_id,
            idempotency_key, status, description
        )
        VALUES ('TOPUP', 'TOPUP', %s, %s, 'PENDING', %s)
        RETURNING ledger_txn_id
        """,
        (str(topup_id), idempotency_key, "Simulated UPI wallet top-up"),
    ).fetchone()

    ledger_txn_id = ledger["ledger_txn_id"]

    connection.execute(
        """
        INSERT INTO ledger_entries (
            ledger_txn_id, account_code, entry_side, amount
        )
        VALUES
            (%s, 'RAILWAY_CLEARING', 'DEBIT', %s),
            (%s, 'CUSTOMER_WALLET', 'CREDIT', %s)
        """,
        (ledger_txn_id, amount, ledger_txn_id, amount),
    )

    connection.execute(
        "UPDATE wallets SET balance = balance + %s WHERE wallet_id = %s",
        (amount, wallet["wallet_id"]),
    )

    connection.execute(
        "UPDATE ledger_txns SET status = 'POSTED' WHERE ledger_txn_id = %s",
        (ledger_txn_id,),
    )

    connection.execute(
        """
        UPDATE topups
        SET ledger_txn_id = %s, status = 'COMPLETED'
        WHERE topup_id = %s
        """,
        (ledger_txn_id, topup_id),
    )

    updated = connection.execute(
        "SELECT balance, currency FROM wallets WHERE wallet_id = %s",
        (wallet["wallet_id"],),
    ).fetchone()

    return {
        "topup_id": topup_id,
        "wallet_id": wallet["wallet_id"],
        "amount": amount,
        "status": "COMPLETED",
        "provider_reference": f"MOCK-UPI-{idempotency_key[:24]}",
        "balance": Decimal(updated["balance"]),
        "currency": updated["currency"],
        "simulated": True,
        "replayed": False,
    }
def get_wallet_transactions(
    connection: Connection,
    user_id: int,
    limit: int = 20,
    offset: int = 0,
) -> dict:
    """Return paginated ledger transactions for the authenticated user's wallet."""
    if not 1 <= limit <= 100:
        raise ValueError("Limit must be between 1 and 100")
    if offset < 0:
        raise ValueError("Offset cannot be negative")

    wallet = connection.execute(
        """
        SELECT wallet_id
        FROM wallets
        WHERE user_id = %s
        """,
        (user_id,),
    ).fetchone()

    if wallet is None:
        return {"items": [], "limit": limit, "offset": offset, "total": 0}

    wallet_id = wallet["wallet_id"]

    total_row = connection.execute(
        """
        SELECT COUNT(*) AS total
        FROM ledger_txns lt
        WHERE lt.status IN ('POSTED', 'REVERSED')
          AND EXISTS (
              SELECT 1
              FROM ledger_entries le
              WHERE le.ledger_txn_id = lt.ledger_txn_id
                AND le.account_code = 'CUSTOMER_WALLET'
          )
          AND (
              (lt.txn_type = 'TOPUP' AND EXISTS (
                  SELECT 1
                  FROM topups t
                  WHERE t.ledger_txn_id = lt.ledger_txn_id
                    AND t.wallet_id = %s
              ))
              OR
              (lt.txn_type = 'REFUND' AND EXISTS (
                  SELECT 1
                  FROM refunds r
                  WHERE r.ledger_txn_id = lt.ledger_txn_id
                    AND r.wallet_id = %s
              ))
          )
        """,
        (wallet_id, wallet_id),
    ).fetchone()

    rows = connection.execute(
        """
        SELECT
            lt.ledger_txn_id,
            lt.txn_type,
            lt.reference_type,
            lt.reference_id,
            lt.status,
            lt.description,
            lt.created_at,
            COALESCE(SUM(le.amount) FILTER (
                WHERE le.account_code = 'CUSTOMER_WALLET'
                  AND le.entry_side = 'CREDIT'
            ), 0) AS credited,
            COALESCE(SUM(le.amount) FILTER (
                WHERE le.account_code = 'CUSTOMER_WALLET'
                  AND le.entry_side = 'DEBIT'
            ), 0) AS debited
        FROM ledger_txns lt
        JOIN ledger_entries le
          ON le.ledger_txn_id = lt.ledger_txn_id
        WHERE lt.status IN ('POSTED', 'REVERSED')
          AND (
              (lt.txn_type = 'TOPUP' AND EXISTS (
                  SELECT 1
                  FROM topups t
                  WHERE t.ledger_txn_id = lt.ledger_txn_id
                    AND t.wallet_id = %s
              ))
              OR
              (lt.txn_type = 'REFUND' AND EXISTS (
                  SELECT 1
                  FROM refunds r
                  WHERE r.ledger_txn_id = lt.ledger_txn_id
                    AND r.wallet_id = %s
              ))
          )
        GROUP BY
            lt.ledger_txn_id, lt.txn_type, lt.reference_type,
            lt.reference_id, lt.status, lt.description, lt.created_at
        ORDER BY lt.created_at DESC, lt.ledger_txn_id DESC
        LIMIT %s OFFSET %s
        """,
        (wallet_id, wallet_id, limit, offset),
    ).fetchall()

    items = []
    for row in rows:
        credited = Decimal(row["credited"])
        debited = Decimal(row["debited"])

        items.append({
            "ledger_txn_id": row["ledger_txn_id"],
            "type": row["txn_type"],
            "reference_type": row["reference_type"],
            "reference_id": row["reference_id"],
            "status": row["status"],
            "description": row["description"],
            "amount": credited if credited > 0 else debited,
            "direction": "CREDIT" if credited > 0 else "DEBIT",
            "created_at": row["created_at"],
        })

    return {
        "items": items,
        "limit": limit,
        "offset": offset,
        "total": total_row["total"],
    }
